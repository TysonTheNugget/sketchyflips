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
    try {
        const contract = new ethers.Contract(gameAddress, gameABI, provider);
        // Use raw log filtering to avoid potential reserved word issues
        const gameResultTopic = ethers.utils.id('GameResult(address,address,bool)');
        const gameStartedTopic = ethers.utils.id('GameStarted(address,address,uint256,uint256)');
        const filter = {
            address: gameAddress,
            topics: [gameResultTopic],
            fromBlock: 0
        };
        const logs = await provider.getLogs(filter);
        for (const log of logs) {
            const parsedLog = contract.interface.parseLog(log);
            if (parsedLog.name === 'GameResult' && log.transactionHash === gameId) {
                const { winner, loser, result } = parsedLog.args;
                // Fetch corresponding GameStarted event in the same transaction
                const startFilter = {
                    address: gameAddress,
                    topics: [gameStartedTopic],
                    fromBlock: log.blockNumber,
                    toBlock: log.blockNumber
                };
                const startLogs = await provider.getLogs(startFilter);
                const startLog = startLogs.find(sLog => sLog.transactionHash === log.transactionHash);
                if (!startLog) return null;
                const startParsed = contract.interface.parseLog(startLog);
                const { tokenId1, tokenId2 } = startParsed.args;
                return {
                    winner: winner.toLowerCase(),
                    loser: loser.toLowerCase(),
                    result: result,
                    tokenId1: tokenId1.toString(),
                    tokenId2: tokenId2.toString()
                };
            }
        }
        return null;
    } catch (error) {
        console.error('Error in getGameWinnerOnChain:', error);
        return null;
    }
}

async function fetchGameHistory() {
    if (!gameContract || !account) {
        console.log('Cannot fetch game history: gameContract or account missing');
        return resolvedGames;
    }
    try {
        const gameStartedTopic = ethers.utils.id('GameStarted(address,address,uint256,uint256)');
        const gameResultTopic = ethers.utils.id('GameResult(address,address,bool)');
        const filter = {
            address: gameAddress,
            topics: [gameStartedTopic],
            fromBlock: 0
        };
        const startLogs = await provider.getLogs(filter);
        const resultLogs = await provider.getLogs({ ...filter, topics: [gameResultTopic] });

        const gamesMap = new Map();
        for (const log of startLogs) {
            const parsedLog = gameContract.interface.parseLog(log);
            const { player1, player2, tokenId1, tokenId2 } = parsedLog.args;
            if (player1.toLowerCase() === account.toLowerCase() || (player2 && player2.toLowerCase() === account.toLowerCase())) {
                gamesMap.set(log.transactionHash, {
                    gameId: log.transactionHash,
                    player1: player1.toLowerCase(),
                    player2: player2 ? player2.toLowerCase() : null,
                    tokenId1: tokenId1.toString(),
                    tokenId2: token2 ? token2.toString() : null,
                    image1: `https://f005.backblazeb2.com/file/sketchymilios/${tokenId1}.png`,
                    image2: token2 ? `https://f005.backblazeb2.com/file/sketchymilios/${token2}.png` : null,
                    choice: player1.toLowerCase() === account.toLowerCase() ? true : false,
                    resolved: false,
                    createTimestamp: (await provider.getBlock(log.blockNumber)).timestamp,
                    joinTimestamp: player2 ? (await provider.getBlock(log.blockNumber)).timestamp : null,
                    userResolved: { [account.toLowerCase()]: false },
                    viewed: { [account.toLowerCase()]: false }
                });
            }
        }

        for (const log of resultLogs) {
            const parsedLog = gameContract.interface.parseLog(log);
            const { winner, loser, result } = parsedLog.args;
            const game = gamesMap.get(log.transactionHash);
            if (game) {
                game.resolved = true;
                game.winner = winner.toLowerCase();
                game.result = result;
                game.joinTimestamp = (await provider.getBlock(log.blockNumber)).timestamp;
            }
        }

        const onChainGames = Array.from(gamesMap.values());
        // Merge with backend resolvedGames, preserving numeric gameId
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
        console.log('Fetched and merged game history:', resolvedGames);
        return resolvedGames;
    } catch (error) {
        console.error('Error fetching game history:', error);
        updateStatus(`Error fetching game history: ${error.message}`);
        return resolvedGames;
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
    } catch (err) {
        console.error('Blockchain query error, falling back to backend:', err);
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
        viewed: { [account?.toLowerCase() || '']: false }
    });
    updateResultsModal(resolvedGames, account);
    updateStatus(`Game #${data.gameId} joined by ${data.player2.slice(0, 6)}...${data.player2.slice(-4)}`);
    await fetchUserTokens();
});

socket.on('resolvedGames', (games) => {
    console.log('Received resolvedGames:', games);
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
        if (data.error === 'Game not resolved or no winner') {
            console.log(`Game ${data.gameId} not yet resolved, retrying...`);
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