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
let isResolving = false;

async function fetchGameHistory() {
    if (!gameContract || !account) {
        console.log('Cannot fetch game history: gameContract or account missing');
        return [];
    }
    try {
        const gameStartedFilter = gameContract.filters.GameStarted(null, null, null, null);
        const gameResultFilter = gameContract.filters.GameResult(null, null, null);
        const [startEvents, resultEvents] = await Promise.all([
            gameContract.queryFilter(gameStartedFilter),
            gameContract.queryFilter(gameResultFilter)
        ]);

        const gamesMap = new Map();
        startEvents.forEach(event => {
            const { player1, player2, tokenId1, tokenId2 } = event.args;
            if (player1.toLowerCase() === account.toLowerCase() || (player2 && player2.toLowerCase() === account.toLowerCase())) {
                gamesMap.set(event.transactionHash, {
                    gameId: event.transactionHash,
                    player1: player1.toLowerCase(),
                    player2: player2 ? player2.toLowerCase() : null,
                    tokenId1: tokenId1.toString(),
                    tokenId2: token2 ? token2.toString() : null,
                    image1: `https://f005.backblazeb2.com/file/sketchymilios/${tokenId1}.png`,
                    image2: token2 ? `https://f005.backblazeb2.com/file/sketchymilios/${token2}.png` : null,
                    choice: player1.toLowerCase() === account.toLowerCase() ? true : false, // true for Heads, false for Tails
                    resolved: false,
                    createTimestamp: (await event.getBlock()).timestamp
                });
            }
        });

        resultEvents.forEach(event => {
            const { winner, loser, result } = event.args;
            const game = gamesMap.get(event.transactionHash);
            if (game) {
                game.resolved = true;
                game.winner = winner.toLowerCase();
                game.result = result;
                game.joinTimestamp = (await event.getBlock()).timestamp;
            }
        });

        const games = Array.from(gamesMap.values());
        console.log('Fetched game history:', games);
        return games;
    } catch (error) {
        console.error('Error fetching game history:', error);
        updateStatus(`Error fetching game history: ${error.message}`);
        return [];
    }
}

async function resolveGame(gameId) {
    if (isResolving) {
        console.log('Resolve already in progress, ignoring click for game:', gameId);
        return;
    }
    if (!account) {
        console.warn('No account connected, skipping resolve');
        updateStatus('Connect wallet to resolve games.');
        return;
    }
    isResolving = true;
    updateStatus('Checking game result...');
    try {
        const games = await fetchGameHistory();
        const game = games.find(g => g.gameId === gameId);
        if (!game || !game.resolved) {
            updateStatus(`Game #${gameId} not yet resolved.`);
            isResolving = false;
            return;
        }
        const win = game.winner === account.toLowerCase();
        playResultVideo(
            win ? '/win.mp4' : '/lose.mp4',
            win ? 'You Win!' : 'You Lose!',
            game.image1,
            game.image2
        );
        updateStatus(`Game #${gameId} resolved: ${win ? 'You Win!' : 'You Lose!'}`);
        socket.emit('markGameResolved', { gameId, account });
        await fetchUserTokens();
        isResolving = false;
    } catch (error) {
        console.error('Error resolving game:', error);
        updateStatus(`Error resolving game: ${error.message}`);
        isResolving = false;
    }
}

initializeUI({ 
    socket, 
    getAccount: () => account, 
    getResolvedGames: fetchGameHistory, 
    getUserTokens: () => userTokens, 
    setSelectedTokenId: (id) => { selectedTokenId = id; },
    resolveGame
});

document.getElementById('connectWallet').addEventListener('click', async () => {
    if (!window.ethereum) {
        updateStatus('Install MetaMask.');
        return;
    }
    try {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        account = await signer.getAddress();
        document.getElementById('accountInfo').textContent = `Account: ${account.slice(0,6)}...${account.slice(-4)}`;
        updateStatus('Wallet connected...');
        
        gameContract = new ethers.Contract(gameAddress, gameABI, provider);
        gameContractWithSigner = gameContract.connect(signer);
        nftContract = new ethers.Contract(nftAddress, nftABI, signer);
        
        socket.emit('registerAddress', { address: account });
        await fetchUserTokens(true);
        updateStatus('Connected! Fetching games...');
    } catch (error) {
        console.error('Error connecting wallet:', error);
        updateStatus(`Connection error: ${error.message}`);
        if (error.code === -32603) {
            updateStatus('RPC Error: Disconnect MetaMask from the website and reconnect.');
        }
    }
});

document.getElementById('createGameBtn').addEventListener('click', async () => {
    if (!gameContractWithSigner) return updateStatus('Connect wallet first.');
    if (!selectedTokenId) return updateStatus('Select an NFT to bet.');
    try {
        updateStatus('Approving NFT...');
        const approveTx = await nftContract.approve(gameAddress, selectedTokenId);
        await approveTx.wait();
        updateStatus('Creating game...');
        const tx = await gameContractWithSigner.createGame(selectedTokenId);
        await tx.wait();
        updateStatus('Game created! Waiting for join...');
        await fetchUserTokens();
        selectedTokenId = null;
        document.getElementById('selectedNFT').innerHTML = 'Your Sketchy';
    } catch (error) {
        console.error('Error creating game:', error);
        updateStatus(`Error creating game: ${error.message}`);
        if (error.code === -32603) {
            updateStatus('RPC Error: Disconnect MetaMask from the website and reconnect.');
        }
    }
});

window.joinGameFromList = async (gameId) => {
    if (!gameContractWithSigner) return updateStatus('Connect wallet first.');
    if (!selectedTokenId) return updateStatus('Select an NFT to bet.');
    try {
        updateStatus('Approving NFT...');
        const approveTx = await nftContract.approve(gameAddress, selectedTokenId);
        await approveTx.wait();
        updateStatus('Joining game...');
        const tx = await gameContractWithSigner.joinGame(gameId, selectedTokenId);
        await tx.wait();
        updateStatus('Joined! Waiting for result...');
        await fetchUserTokens();
        selectedTokenId = null;
        document.getElementById('selectedNFT').innerHTML = 'Your Sketchy';
    } catch (error) {
        console.error('Error joining game:', error);
        updateStatus(`Error joining: ${error.message}`);
        if (error.code === -32603) {
            updateStatus('RPC Error: Disconnect MetaMask from the website and reconnect.');
        }
    }
};

window.cancelUnjoinedFromList = async (gameId) => {
    if (!gameContractWithSigner) return updateStatus('Connect wallet first.');
    try {
        updateStatus('Canceling game...');
        const tx = await gameContractWithSigner.cancelUnjoinedGame(gameId);
        await tx.wait();
        updateStatus('Game canceled.');
        await fetchUserTokens();
    } catch (error) {
        console.error('Error canceling unjoined game:', error);
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
        console.log('Tokens fetched:', tokens);
        for (let id of tokens) {
            const image = `https://f005.backblazeb2.com/file/sketchymilios/${id}.png`;
            userTokens.push({ id: id.toString(), image });
        }
        console.log('User tokens loaded:', userTokens);
        document.getElementById('selectNFTBtn').disabled = userTokens.length === 0;
        document.getElementById('createGameBtn').disabled = userTokens.length === 0;
        if (userTokens.length === 0) {
            nftGrid.innerHTML = '<p class="text-center text-xs">No NFTs owned</p>';
        } else {
            displayNFTsInModal(userTokens);
        }
        if (showLoading) hideLoadingScreen();
    } catch (error) {
        console.error('Error fetching tokens:', error);
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
    console.log('Received openGamesUpdate:', games);
    updateOpenGames(games, account);
});

socket.on('gameJoined', async (data) => {
    console.log('Received gameJoined:', data);
    updateStatus(`Game #${data.gameId} joined by ${data.player2.slice(0, 6)}...${data.player2.slice(-4)}`);
    await fetchUserTokens();
});

socket.on('disconnect', () => {
    console.log('Disconnected from backend');
    updateStatus('Disconnected from backend, attempting reconnect...');
});

socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    updateStatus(`Socket connection error: ${error.message}`);
});

socket.on('reconnect', (attempt) => {
    console.log('Reconnected to backend after attempt:', attempt);
    if (account) {
        socket.emit('registerAddress', { address: account });
    }
    updateStatus('Reconnected to backend!');
});

socket.on('reconnect_error', (error) => {
    console.error('Socket reconnection error:', error);
    updateStatus(`Socket reconnection error: ${error.message}`);
});