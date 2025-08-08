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
let createdGames = [];
let joinedGames = [];
let isResolving = false;
let isCreating = false;
let isJoining = false;
let isApproving = false;

async function initializeProvider() {
    if (window.ethereum) {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        await provider.send("eth_requestAccounts", []);
        signer = provider.getSigner();
        account = await signer.getAddress();
        gameContract = new ethers.Contract(gameAddress, gameABI, provider);
        gameContractWithSigner = gameContract.connect(signer);
        nftContract = new ethers.Contract(nftAddress, nftABI, signer);
        document.getElementById('accountInfo').textContent = `Account: ${account.slice(0, 6)}...${account.slice(-4)}`;
        socket.emit('registerAddress', { address: account });
        await fetchUserTokens();
        await checkApproval();
        socket.emit('fetchResolvedGames', { account });
        updateStatus('Connected to wallet and backend.');
    } else {
        updateStatus('Please install MetaMask or another wallet.');
    }
}

async function fetchUserTokens() {
    showLoadingScreen();
    try {
        userTokens = await nftContract.tokensOfOwner(account);
        userTokens = userTokens.map(id => id.toString());
        hideLoadingScreen();
        if (userTokens.length === 0) {
            updateStatus('No Sketchys found in your wallet.');
        }
    } catch (err) {
        console.error('Error fetching NFTs:', err);
        updateStatus('Error loading NFTs');
        hideLoadingScreen();
    }
}

async function checkApproval() {
    try {
        const isApproved = await nftContract.isApprovedForAll(account, gameAddress);
        return isApproved;
    } catch (err) {
        console.error('Error checking approval:', err);
        updateStatus('Error checking NFT approval');
        return false;
    }
}

async function approveAll() {
    isApproving = true;
    updateStatus('Approving contract for NFTs...');
    try {
        const tx = await nftContract.setApprovalForAll(gameAddress, true);
        await tx.wait();
        isApproving = false;
        updateStatus('Contract approved for NFTs.');
        return true;
    } catch (err) {
        console.error('Error approving contract:', err);
        updateStatus('Error approving contract');
        isApproving = false;
        return false;
    }
}

async function createGame() {
    if (!account) {
        updateStatus('Connect wallet to create a game.');
        return;
    }
    if (!selectedTokenId) {
        updateStatus('Select an NFT first.');
        return;
    }
    if (!(await checkApproval())) {
        updateStatus('Please approve the contract first.');
        document.getElementById('selectNFTBtn').click();
        return;
    }
    isCreating = true;
    updateStatus('Creating game...');
    try {
        const tx = await gameContractWithSigner.createGame(selectedTokenId);
        const receipt = await tx.wait();
        const gameId = receipt.events.find(e => e.event === 'GameCreated')?.args.gameId.toString();
        createdGames.push(gameId);
        updateStatus(`Game #${gameId} created! Waiting for a player to join...`);
        isCreating = false;
        await fetchUserTokens();
    } catch (err) {
        console.error('Error creating game:', err);
        updateStatus('Error creating game');
        isCreating = false;
    }
}

async function joinGame(gameId) {
    if (!account) {
        updateStatus('Connect wallet to join a game.');
        return;
    }
    if (!selectedTokenId) {
        updateStatus('Select an NFT first.');
        return;
    }
    if (!(await checkApproval())) {
        updateStatus('Please approve the contract first.');
        document.getElementById('selectNFTBtn').click();
        return;
    }
    isJoining = true;
    updateStatus(`Joining game #${gameId}...`);
    try {
        const tx = await gameContractWithSigner.joinGame(gameId, selectedTokenId);
        await tx.wait();
        joinedGames.push(gameId);
        updateStatus(`Joined game #${gameId}! Waiting for resolution...`);
        isJoining = false;
        await fetchUserTokens();
    } catch (err) {
        console.error('Error joining game:', err);
        updateStatus('Error joining game');
        isJoining = false;
    }
}

async function getGameWinnerOnChain(gameId) {
    try {
        const topic = ethers.utils.id('GameResolved(uint256,address,uint256,uint256)');
        const filter = {
            address: gameAddress,
            topics: [topic, ethers.utils.hexZeroPad(ethers.utils.hexValue(Number(gameId)), 32)]
        };
        const logs = await provider.getLogs(filter);
        if (logs.length > 0) {
            const event = gameContract.interface.parseLog(logs[0]);
            return {
                winner: event.args.winner.toLowerCase(),
                tokenId1: event.args.tokenId1.toString(),
                tokenId2: event.args.tokenId2.toString()
            };
        }
        return null;
    } catch (err) {
        console.error('Error fetching game winner:', err);
        return null;
    }
}

async function resolveGame(gameId) {
    if (isResolving) {
        console.log('Resolve already in progress, ignoring click for game:', gameId);
        return;
    }
    if (!account) {
        updateStatus('Connect wallet to resolve games.');
        return;
    }
    isResolving = true;
    updateStatus('Checking blockchain for result...');
    try {
        const chainResult = await getGameWinnerOnChain(gameId);
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
        updateStatus('Loading... Checking game resolution...');
        socket.emit('resolveGame', { gameId, account });
        setTimeout(() => {
            if (isResolving) {
                isResolving = false;
                updateStatus('Resolution timed out, please try again.');
                socket.emit('fetchResolvedGames', { account });
            }
        }, 60000);
    } catch (err) {
        console.error('Error resolving game:', err);
        updateStatus('Error resolving game');
        isResolving = false;
    }
}

document.getElementById('connectButton').addEventListener('click', async () => {
    await initializeProvider();
});

document.getElementById('createGameBtn').addEventListener('click', createGame);

document.getElementById('homeButton').addEventListener('click', () => {
    document.getElementById('mainMenu').classList.remove('hidden');
    document.getElementById('gameControls').classList.add('hidden');
});

initializeUI({
    socket,
    getAccount: () => account,
    getResolvedGames: () => resolvedGames,
    getUserTokens: () => userTokens,
    setSelectedTokenId: (id) => {
        selectedTokenId = id;
        selectNFT(id);
    },
    resolveGame
});

socket.on('connect', () => {
    console.log('Connected to backend:', socket.id);
    if (account) {
        socket.emit('registerAddress', { address: account });
    }
    updateStatus('Connected to backend, waiting for games...');
});

socket.on('openGamesUpdate', async (games) => {
    console.log('Received openGamesUpdate:', games);
    updateOpenGames(games.concat(createdGames.map(id => ({ gameId: id, player1: account, tokenId1: selectedTokenId }))), account, joinGame);
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
    updateResultsModal(resolvedGames, account, resolveGame);
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
    updateResultsModal(resolvedGames, account, resolveGame);
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