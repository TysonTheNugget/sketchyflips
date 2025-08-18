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
    console.log('getGameWinnerOnChain: Querying for gameId:', gameId);
    try {
        const contract = new ethers.Contract(gameAddress, gameABI, provider);
        const topic = ethers.utils.id('GameResult(address,address,bool)');
        const filter = {
            address: gameAddress,
            topics: [topic],
            fromBlock: 0
        };
        const logs = await provider.getLogs(filter);
        console.log('getGameWinnerOnChain: Found', logs.length, 'GameResult logs');
        for (const log of logs) {
            const parsedLog = contract.interface.parseLog(log);
            const startTopic = ethers.utils.id('GameStarted(address,address,uint256,uint256)');
            const startFilter = {
                address: gameAddress,
                topics: [startTopic],
                fromBlock: log.blockNumber,
                toBlock: log.blockNumber
            };
            const startLogs = await provider.getLogs(startFilter);
            const startEvent = startLogs.find(s => s.transactionHash === log.transactionHash);
            if (startEvent) {
                const startParsed = contract.interface.parseLog(startEvent);
                console.log('getGameWinnerOnChain: Matched GameStarted for tx:', log.transactionHash);
                return {
                    winner: parsedLog.args.winner.toLowerCase(),
                    tokenId1: startParsed.args.tokenId1.toString(),
                    tokenId2: startParsed.args.tokenId2.toString(),
                    result: parsedLog.args.result ? 'Won' : 'Lost'
                };
            }
        }
        console.log('getGameWinnerOnChain: No matching GameResult for gameId:', gameId);
        return null;
    } catch (error) {
        console.error('getGameWinnerOnChain: Error:', error);
        return null;
    }
}

async function fetchGameHistory() {
    if (!gameContract || !account) {
        console.log('fetchGameHistory: Missing gameContract or account');
        return resolvedGames;
    }
    console.log('fetchGameHistory: Fetching for account:', account, 'on contract:', gameAddress);
    try {
        const contract = new ethers.Contract(gameAddress, gameABI, provider);
        const startTopic = ethers.utils.id('GameStarted(address,address,uint256,uint256)');
        const resultTopic = ethers.utils.id('GameResult(address,address,bool)');
        const startFilter = {
            address: gameAddress,
            topics: [startTopic],
            fromBlock: 0
        };
        const resultFilter = {
            address: gameAddress,
            topics: [resultTopic],
            fromBlock: 0
        };
        const [startLogs, resultLogs] = await Promise.all([
            provider.getLogs(startFilter),
            provider.getLogs(resultFilter)
        ]);
        console.log('fetchGameHistory: Found', startLogs.length, 'GameStarted logs and', resultLogs.length, 'GameResult logs');

        const gamesMap = new Map();
        for (const log of startLogs) {
            const parsed = contract.interface.parseLog(log);
            const { player1, player2, tokenId1, tokenId2 } = parsed.args;
            if (player1.toLowerCase() === account.toLowerCase() || (player2 && player2.toLowerCase() === account.toLowerCase())) {
                console.log('fetchGameHistory: Found game - tx:', log.transactionHash, 'player1:', player1, 'player2:', player2);
                const localDate = new Date((await provider.getBlock(log.blockNumber)).timestamp * 1000).toLocaleString();
                gamesMap.set(log.transactionHash, {
                    gameId: log.transactionHash,
                    player1: player1.toLowerCase(),
                    player2: player2 ? player2.toLowerCase() : null,
                    tokenId1: tokenId1.toString(),
                    tokenId2: token2 ? tokenId2.toString() : null,
                    image1: `https://f005.backblazeb2.com/file/sketchymilios/${tokenId1}.png`,
                    image2: token2 ? `https://f005.backblazeb2.com/file/sketchymilios/${tokenId2}.png` : null,
                    choice: player1.toLowerCase() === account.toLowerCase() ? true : false,
                    resolved: false,
                    localDate: localDate,
                    userResolved: { [account.toLowerCase()]: false },
                    viewed: { [account.toLowerCase()]: false }
                });
            }
        }

        for (const log of resultLogs) {
            const parsed = contract.interface.parseLog(log);
            const { winner, loser, result } = parsed.args;
            const game = gamesMap.get(log.transactionHash);
            if (game) {
                console.log('fetchGameHistory: Found result - tx:', log.transactionHash, 'winner:', winner);
                game.resolved = true;
                game.winner = winner.toLowerCase();
                game.result = winner.toLowerCase() === account.toLowerCase() ? 'Won' : 'Lost';
                game.localDate = new Date((await provider.getBlock(log.blockNumber)).timestamp * 1000).toLocaleString();
            }
        }

        const onChainGames = Array.from(gamesMap.values());
        console.log('fetchGameHistory: On-chain games:', onChainGames);
        // Merge with backend resolvedGames
        const mergedGames = [...resolvedGames];
        onChainGames.forEach(ocGame => {
            const existing = mergedGames.find(g => g.gameId === ocGame.gameId);
            if (!existing) {
                mergedGames.push({ ...ocGame, gameId: `onchain_${ocGame.gameId}` });
            } else {
                Object.assign(existing, ocGame);
            }
        });
        resolvedGames = mergedGames;
        console.log('fetchGameHistory: Merged game history:', resolvedGames);
        return resolvedGames;
    } catch (error) {
        console.error('fetchGameHistory: Error:', error);
        updateStatus(`Error fetching game history: ${error.message}`);
        return resolvedGames;
    }
}

async function resolveGame(gameId) {
    if (isResolving) {
        console.log('resolveGame: Already in progress for game:', gameId);
        return;
    }
    if (!account) {
        console.log('resolveGame: No account connected');
        updateStatus('Connect wallet to resolve games.');
        return;
    }
    isResolving = true;
    updateStatus('Checking blockchain for result...');
    try {
        const chainResult = await getGameWinnerOnChain(gameId, gameAddress, gameABI, provider);
        if (chainResult) {
            const win = account && chainResult.winner === account.toLowerCase();
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
        console.log('resolveGame: No on-chain result, falling back to backend for game:', gameId);
    } catch (err) {
        console.error('resolveGame: Blockchain query error:', err);
    }
    updateStatus('Loading... Checking game resolution...');
    socket.emit('resolveGame', { gameId, account });
    setTimeout(() => {
        if (isResolving) {
            isResolving = false;
            updateStatus('Resolution timed out, please try again.');
            socket.emit('fetchResolvedGames', { account });
        }
    }, 60000);
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
        console.log('connectWallet: MetaMask not detected');
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
        socket.emit('fetchResolvedGames', { account });
    } catch (error) {
        console.error('connectWallet: Error:', error);
        updateStatus(`Connection error: ${error.message}`);
        if (error.code === -32603) {
            updateStatus('RPC Error: Disconnect MetaMask from the website and reconnect.');
        }
    }
});

document.getElementById('createGameBtn').addEventListener('click', async () => {
    if (!gameContractWithSigner) {
        console.log('createGameBtn: No signer');
        return updateStatus('Connect wallet first.');
    }
    if (!selectedTokenId) {
        console.log('createGameBtn: No NFT selected');
        return updateStatus('Select an NFT to bet.');
    }
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
        console.error('createGameBtn: Error:', error);
        updateStatus(`Error creating game: ${error.message}`);
        if (error.code === -32603) {
            updateStatus('RPC Error: Disconnect MetaMask from the website and reconnect.');
        }
    }
});

window.joinGameFromList = async (gameId) => {
    if (!gameContractWithSigner) {
        console.log('joinGameFromList: No signer');
        return updateStatus('Connect wallet first.');
    }
    if (!selectedTokenId) {
        console.log('joinGameFromList: No NFT selected');
        return updateStatus('Select an NFT to bet.');
    }
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
        console.error('joinGameFromList: Error:', error);
        updateStatus(`Error joining: ${error.message}`);
        if (error.code === -32603) {
            updateStatus('RPC Error: Disconnect MetaMask from the website and reconnect.');
        }
    }
};

window.cancelUnjoinedFromList = async (gameId) => {
    if (!gameContractWithSigner) {
        console.log('cancelUnjoinedFromList: No signer');
        return updateStatus('Connect wallet first.');
    }
    try {
        updateStatus('Canceling game...');
        const tx = await gameContractWithSigner.cancelUnjoinedGame(gameId);
        await tx.wait();
        updateStatus('Game canceled.');
        await fetchUserTokens();
    } catch (error) {
        console.error('cancelUnjoinedFromList: Error:', error);
        updateStatus(`Error canceling: ${error.message}`);
        if (error.code === -32603) {
            updateStatus('RPC Error: Disconnect MetaMask from the website and reconnect.');
        }
    }
};

async function fetchUserTokens(showLoading = false) {
    if (!nftContract || !account) {
        console.log('fetchUserTokens: Missing nftContract or account');
        return;
    }
    if (showLoading) showLoadingScreen();
    userTokens = [];
    const nftGrid = document.getElementById('nftGrid');
    nftGrid.innerHTML = '<p class="text-center text-xs">Loading NFTs...</p>';
    try {
        console.log('fetchUserTokens: Fetching for account:', account);
        const tokens = await nftContract.tokensOfOwner(account);
        console.log('fetchUserTokens: Tokens fetched:', tokens);
        for (let id of tokens) {
            const image = `https://f005.backblazeb2.com/file/sketchymilios/${id}.png`;
            userTokens.push({ id: id.toString(), image });
        }
        console.log('fetchUserTokens: User tokens loaded:', userTokens);
        document.getElementById('selectNFTBtn').disabled = userTokens.length === 0;
        document.getElementById('createGameBtn').disabled = userTokens.length === 0;
        if (userTokens.length === 0) {
            nftGrid.innerHTML = '<p class="text-center text-xs">No NFTs owned</p>';
        } else {
            displayNFTsInModal(userTokens);
        }
        if (showLoading) hideLoadingScreen();
    } catch (error) {
        console.error('fetchUserTokens: Error:', error);
        updateStatus(`Tokens fetch error: ${error.message}`);
        nftGrid.innerHTML = '<p class="text-center text-red-500 text-xs">Error loading NFTs</p>';
        if (showLoading) hideLoadingScreen();
    }
}

// Socket.IO event listeners
socket.on('connect', () => {
    console.log('socket: Connected to backend:', socket.id);
    if (account) {
        socket.emit('registerAddress', { address: account });
    }
    updateStatus('Connected to backend, waiting for games...');
});

socket.on('openGamesUpdate', (games) => {
    console.log('socket: Received openGamesUpdate:', games);
    updateOpenGames(games, account);
});

socket.on('gameJoined', async (data) => {
    console.log('socket: Received gameJoined:', data);
    resolvedGames.push({
        gameId: data.gameId,
        player1: data.player1,
        tokenId1: data.tokenId1,
        image1: data.image1,
        player2: data.player2,
        tokenId2: data.tokenId2,
        image2: data.image2,
        resolved: false,
        localDate: new Date().toLocaleString(),
        userResolved: { [account?.toLowerCase() || '']: false },
        viewed: { [account?.toLowerCase() || '']: false }
    });
    updateResultsModal(resolvedGames, account);
    updateStatus(`Game #${data.gameId} joined by ${data.player2.slice(0, 6)}...${data.player2.slice(-4)}`);
    await fetchUserTokens();
});

socket.on('resolvedGames', (games) => {
    console.log('socket: Received resolvedGames:', games);
    resolvedGames = games.map(game => ({
        ...game,
        userResolved: game.userResolved || { [account?.toLowerCase() || '']: false },
        viewed: game.viewed || { [account?.toLowerCase() || '']: false }
    }));
    updateResultsModal(resolvedGames, account);
});

socket.on('gameResolution', async (data) => {
    console.log('socket: Received gameResolution:', data);
    if (data.error) {
        if (data.error === 'Game not resolved or no winner') {
            console.log('socket: Game not resolved, retrying:', data.gameId);
            setTimeout(() => {
                socket.emit('fetchResolvedGames', { account });
            }, 3000);
            return;
        }
        updateStatus(`Error resolving game #${data.gameId}: ${data.error}`);
        isResolving = false;
        return;
    }
    isResolving = false;
    const win = account && data.winner && data.winner.toLowerCase() === account.toLowerCase();
    updateStatus(`Game #${data.gameId} resolved: ${win ? 'You Win!' : 'You Lose!'}`);
    playResultVideo(
        win ? '/win.mp4' : '/lose.mp4',
        win ? 'You Win!' : 'You Lose!',
        data.image1 || 'https://via.placeholder.com/64',
        data.image2 || 'https://via.placeholder.com/64'
    );
    if (account) {
        socket.emit('markGameResolved', { gameId: data.gameId, account });
    }
    socket.emit('fetchResolvedGames', { account });
    await fetchUserTokens();
});

socket.on('disconnect', () => {
    console.log('socket: Disconnected from backend');
    updateStatus('Disconnected from backend, attempting reconnect...');
});

socket.on('connect_error', (error) => {
    console.error('socket: Connection error:', error);
    updateStatus(`Socket connection error: ${error.message}`);
});

socket.on('reconnect', (attempt) => {
    console.log('socket: Reconnected to backend, attempt:', attempt);
    if (account) {
        socket.emit('registerAddress', { address: account });
    }
    updateStatus('Reconnected to backend!');
});

socket.on('reconnect_error', (error) => {
    console.error('socket: Reconnection error:', error);
    updateStatus(`Socket reconnection error: ${error.message}`);
});