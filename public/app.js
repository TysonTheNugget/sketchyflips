import { gameABI, nftABI } from './abis.js';
import { initializeUI, showLoadingScreen, hideLoadingScreen, updateStatus, displayNFTsInModal, selectNFT, updateOpenGames, updateResultsModal, playResultVideo } from './ui.js';

const gameAddress = '0xf6b8d2E0d36669Ed82059713BDc6ACfABe11Fde6';
const nftAddress = '0x08533a2b16e3db03eebd5b23210122f97dfcb97d';
const socket = io('https://sketchyflipback.onrender.com', {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});

let provider, signer, account, gameContract, gameContractWithSigner, nftContract;
let selectedTokenId = null;
let userTokens = [];
let resolvedGames = [];
let isResolving = false;

async function getGameWinnerOnChain(gameId, gameAddress, gameABI, provider) {
    console.log(`Fetching blockchain winner for game ${gameId}`);
    try {
        const contract = new ethers.Contract(gameAddress, gameABI, provider);
        const topic = ethers.utils.id('GameResolved(uint256,address,uint256,uint256)');
        const filter = {
            address: gameAddress,
            topics: [
                topic,
                ethers.utils.hexZeroPad(ethers.utils.hexValue(Number(gameId)), 32)
            ]
        };
        const logs = await provider.getLogs(filter);
        if (logs.length > 0) {
            const event = contract.interface.parseLog(logs[0]);
            console.log(`Found GameResolved event for game ${gameId}:`, event.args);
            return {
                winner: event.args.winner.toLowerCase(),
                tokenId1: event.args.tokenId1.toString(),
                tokenId2: event.args.tokenId2.toString()
            };
        }
        console.log(`No GameResolved event for game ${gameId}, checking cancellation`);
        const cancelTopic = ethers.utils.id('GameCanceled(uint256)');
        const cancelFilter = {
            address: gameAddress,
            topics: [
                cancelTopic,
                ethers.utils.hexZeroPad(ethers.utils.hexValue(Number(gameId)), 32)
            ]
        };
        const cancelLogs = await provider.getLogs(cancelFilter);
        if (cancelLogs.length > 0) {
            console.log(`Game ${gameId} was canceled`);
            return { error: 'Game was canceled' };
        }
        console.log(`No resolution or cancellation found for game ${gameId}`);
        return null;
    } catch (error) {
        console.error(`Error fetching blockchain winner for game ${gameId}:`, error.message, error.stack);
        return null;
    }
}

async function resolveGame(gameId) {
    if (isResolving) {
        console.log('Resolve already in progress, ignoring click for game:', gameId);
        updateStatus('Resolution in progress, please wait...');
        return;
    }
    if (!account) {
        console.warn('No account connected, skipping resolve');
        updateStatus('Connect wallet to resolve games.');
        return;
    }
    isResolving = true;
    updateStatus(`Resolving game #${gameId}...`);
    try {
        // Try blockchain first
        const chainResult = await getGameWinnerOnChain(gameId, gameAddress, gameABI, provider);
        if (chainResult) {
            if (chainResult.error) {
                console.log(`Game ${gameId} resolution failed: ${chainResult.error}`);
                updateStatus(`Game #${gameId}: ${chainResult.error}`);
                isResolving = false;
                return;
            }
            const win = account && chainResult.winner === account.toLowerCase();
            console.log(`Game ${gameId} resolved on chain: ${win ? 'Win' : 'Lose'}`);
            updateStatus(`Game #${gameId} resolved: ${win ? 'You Win!' : 'You Lose!'}`);
            playResultVideo(
                win ? '/win.mp4' : '/lose.mp4',
                win ? 'You Win!' : 'You Lose!',
                `https://f005.backblazeb2.com/file/sketchymilios/${chainResult.tokenId1}.png`,
                `https://f005.backblazeb2.com/file/sketchymilios/${chainResult.tokenId2}.png`
            );
            socket.emit('markGameResolved', { gameId, account });
            socket.emit('fetchResolvedGames', { account });
            setTimeout(() => {
                socket.emit('fetchResolvedGames', { account });
            }, 2000);
            await fetchUserTokens();
            isResolving = false;
            return;
        }
        // Fallback to backend
        console.log(`No blockchain result for game ${gameId}, falling back to backend`);
        updateStatus(`Game #${gameId}: Checking backend...`);
        socket.emit('resolveGame', { gameId, account });
    } catch (error) {
        console.error(`Error resolving game ${gameId}:`, error.message, error.stack);
        updateStatus(`Error resolving game #${gameId}: ${error.message}`);
        isResolving = false;
        socket.emit('fetchResolvedGames', { account });
    }
    // Timeout to prevent hanging
    setTimeout(() => {
        if (isResolving) {
            console.warn(`Resolution timeout for game ${gameId}`);
            isResolving = false;
            updateStatus(`Game #${gameId} resolution timed out, please try again.`);
            socket.emit('fetchResolvedGames', { account });
        }
    }, 30000); // Reduced timeout to 30 seconds
}

initializeUI({ 
    socket, 
    getAccount: () => account, 
    getResolvedGames: () => resolvedGames, 
    getUserTokens: () => userTokens, 
    setSelectedTokenId: (id) => { 
        selectedTokenId = id; 
        console.log('Selected token ID set to:', id);
    },
    resolveGame
});

document.getElementById('connectWallet').addEventListener('click', async () => {
    if (!window.ethereum) {
        console.error('MetaMask not detected');
        updateStatus('Install MetaMask.');
        return;
    }
    try {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        account = await signer.getAddress();
        console.log('Wallet connected:', account);
        document.getElementById('accountInfo').textContent = `Account: ${account.slice(0,6)}...${account.slice(-4)}`;
        updateStatus('Wallet connected...');
        
        gameContract = new ethers.Contract(gameAddress, gameABI, provider);
        gameContractWithSigner = gameContract.connect(signer);
        nftContract = new ethers.Contract(nftAddress, nftABI, signer);
        
        socket.emit('registerAddress', { address: account });
        await fetchUserTokens(true);
        updateStatus('Connected! Fetching games...');
        socket.emit('fetchResolvedGames', { account });
    } catch (error) {
        console.error('Error connecting wallet:', error.message, error.stack);
        updateStatus(`Connection error: ${error.message}`);
        if (error.code === -32603) {
            updateStatus('RPC Error: Disconnect MetaMask from the website and reconnect.');
        }
    }
});

document.getElementById('createGameBtn').addEventListener('click', async () => {
    if (!gameContractWithSigner) {
        console.warn('No signer connected');
        return updateStatus('Connect wallet first.');
    }
    if (!selectedTokenId) {
        console.warn('No NFT selected');
        return updateStatus('Select an NFT to bet.');
    }
    try {
        updateStatus('Approving NFT...');
        const approveTx = await nftContract.approve(gameAddress, selectedTokenId);
        await approveTx.wait();
        console.log('NFT approved, creating game with token:', selectedTokenId);
        updateStatus('Creating game...');
        const tx = await gameContractWithSigner.createGame(selectedTokenId);
        await tx.wait();
        console.log('Game created successfully');
        updateStatus('Game created! Waiting for join...');
        await fetchUserTokens();
        selectedTokenId = null;
        document.getElementById('selectedNFT').innerHTML = 'Your Sketchy';
    } catch (error) {
        console.error('Error creating game:', error.message, error.stack);
        updateStatus(`Error creating game: ${error.message}`);
        if (error.code === -32603) {
            updateStatus('RPC Error: Disconnect MetaMask from the website and reconnect.');
        }
    }
});

window.joinGameFromList = async (gameId) => {
    if (!gameContractWithSigner) {
        console.warn('No signer connected');
        return updateStatus('Connect wallet first.');
    }
    if (!selectedTokenId) {
        console.warn('No NFT selected');
        return updateStatus('Select an NFT to bet.');
    }
    try {
        updateStatus('Approving NFT...');
        const approveTx = await nftContract.approve(gameAddress, selectedTokenId);
        await approveTx.wait();
        console.log('NFT approved, joining game:', gameId);
        updateStatus('Joining game...');
        const tx = await gameContractWithSigner.joinGame(gameId, selectedTokenId);
        await tx.wait();
        console.log('Game joined successfully');
        updateStatus('Joined! Waiting for result...');
        await fetchUserTokens();
        selectedTokenId = null;
        document.getElementById('selectedNFT').innerHTML = 'Your Sketchy';
    } catch (error) {
        console.error('Error joining game:', error.message, error.stack);
        updateStatus(`Error joining: ${error.message}`);
        if (error.code === -32603) {
            updateStatus('RPC Error: Disconnect MetaMask from the website and reconnect.');
        }
    }
};

window.cancelUnjoinedFromList = async (gameId) => {
    if (!gameContractWithSigner) {
        console.warn('No signer connected');
        return updateStatus('Connect wallet first.');
    }
    try {
        console.log('Canceling game:', gameId);
        updateStatus('Canceling game...');
        const tx = await gameContractWithSigner.cancelUnjoinedGame(gameId);
        await tx.wait();
        console.log('Game canceled successfully');
        updateStatus('Game canceled.');
        await fetchUserTokens();
    } catch (error) {
        console.error('Error canceling unjoined game:', error.message, error.stack);
        updateStatus(`Error canceling: ${error.message}`);
        if (error.code === -32603) {
            updateStatus('RPC Error: Disconnect MetaMask from the website and reconnect.');
        }
    }
};

async function fetchUserTokens(showLoading = false) {
    if (!nftContract || !account) {
        console.log('Cannot fetch tokens: nftContract or account missing');
        return;
    }
    if (showLoading) showLoadingScreen();
    userTokens = [];
    const nftGrid = document.getElementById('nftGrid');
    nftGrid.innerHTML = '<p class="text-center text-xs">Loading NFTs...</p>';
    try {
        console.log('Fetching tokens for account:', account);
        const tokens = await nftContract.tokensOfOwner(account);
        console.log('Tokens fetched:', tokens.length);
        for (let id of tokens) {
            const image = `https://f005.backblazeb2.com/file/sketchymilios/${id}.png`;
            userTokens.push({ id: id.toString(), image });
        }
        console.log('User tokens loaded:', userTokens.length);
        document.getElementById('selectNFTBtn').disabled = userTokens.length === 0;
        document.getElementById('createGameBtn').disabled = userTokens.length === 0;
        if (userTokens.length === 0) {
            nftGrid.innerHTML = '<p class="text-center text-xs">No NFTs owned</p>';
        } else {
            displayNFTsInModal(userTokens);
        }
        if (showLoading) hideLoadingScreen();
    } catch (error) {
        console.error('Error fetching tokens:', error.message, error.stack);
        updateStatus(`Tokens fetch error: ${error.message}`);
        nftGrid.innerHTML = '<p class="text-center text-red-500 text-xs">Error loading NFTs</p>';
        if (showLoading) hideLoadingScreen();
    }
}

// Socket.IO event listeners
socket.on('connect', () => {
    console.log('Connected to backend:', socket.id);
    if (account) {
        socket.emit('registerAddress', { address: account });
    }
    updateStatus('Connected to backend, waiting for games...');
});

socket.on('openGamesUpdate', (games) => {
    console.log('Received openGamesUpdate:', games.length, 'games');
    updateOpenGames(games, account);
});

socket.on('gameJoined', async (data) => {
    console.log('Received gameJoined:', data);
    resolvedGames = resolvedGames.filter(g => g.gameId !== data.gameId);
    resolvedGames.push({ 
        gameId: data.gameId, 
        player1: data.player1, 
        tokenId1: data.tokenId1, 
        image1: data.image1,
        player2: data.player2, 
        tokenId2: data.tokenId2, 
        image2: data.image2,
        resolved: false, 
        userResolved: { [account?.toLowerCase() || '']: false }, 
        viewed: { [account?.toLowerCase() || '']: false },
        createTimestamp: data.createTimestamp,
        joinTimestamp: data.joinTimestamp
    });
    updateResultsModal(resolvedGames, account);
    updateStatus(`Game #${data.gameId} joined by ${data.player2.slice(0, 6)}...${data.player2.slice(-4)}`);
    await fetchUserTokens();
});

socket.on('resolvedGames', (games) => {
    console.log('Received resolvedGames:', games.length, 'games');
    resolvedGames = games.map(game => ({
        ...game,
        userResolved: game.userResolved || { [account?.toLowerCase() || '']: false },
        viewed: game.viewed || { [account?.toLowerCase() || '']: false }
    }));
    updateResultsModal(resolvedGames, account);
});

socket.on('gameResolution', async (data) => {
    console.log('Received gameResolution:', data);
    if (data.error) {
        console.log(`Game resolution error for ${data.gameId}: ${data.error}`);
        if (data.error === 'Game not resolved or canceled' || data.error === 'Game was canceled') {
            console.log(`Retrying fetch for game ${data.gameId}`);
            setTimeout(() => {
                socket.emit('fetchResolvedGames', { account });
            }, 3000);
            updateStatus(`Game #${data.gameId}: ${data.error}, retrying...`);
            return;
        }
        updateStatus(`Error resolving game #${data.gameId}: ${data.error}`);
        isResolving = false;
        socket.emit('fetchResolvedGames', { account });
        return;
    }
    isResolving = false;
    const win = account && data.winner && data.winner.toLowerCase() === account.toLowerCase();
    console.log(`Game ${data.gameId} resolved: ${win ? 'Win' : 'Lose'}`);
    updateStatus(`Game #${data.gameId} resolved: ${win ? 'You Win!' : 'You Lose!'}`);
    playResultVideo(
        win ? '/win.mp4' : '/lose.mp4', 
        win ? 'You Win!' : 'You Lose!', 
        data.image1 || 'https://via.placeholder.com/64',
        data.image2 || 'https://via.placeholder.com/64'
    );
    if (account) {
        socket.emit('markGameResolved', { gameId: data.gameId, account });
        resolvedGames = resolvedGames.map(game =>
            game.gameId === data.gameId ? {
                ...game,
                userResolved: { ...game.userResolved, [account.toLowerCase()]: true },
                viewed: { ...game.viewed, [account.toLowerCase()]: true }
            } : game
        );
    }
    socket.emit('fetchResolvedGames', { account });
    await fetchUserTokens();
});

socket.on('disconnect', () => {
    console.log('Disconnected from backend');
    updateStatus('Disconnected from backend, attempting reconnect...');
});

socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error.message, error.stack);
    updateStatus(`Socket connection error: ${error.message}`);
});

socket.on('reconnect', (attempt) => {
    console.log('Reconnected to backend after attempt:', attempt);
    if (account) {
        socket.emit('registerAddress', { address: account });
        socket.emit('fetchResolvedGames', { account });
    }
    updateStatus('Reconnected to backend!');
});

socket.on('reconnect_error', (error) => {
    console.error('Socket reconnection error:', error.message, error.stack);
    updateStatus(`Socket reconnection error: ${error.message}`);
});