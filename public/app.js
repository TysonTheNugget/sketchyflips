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
let resolveTimeouts = new Map(); // Track resolve timeouts

function resolveGame(gameId) {
    if (isResolving) {
        console.log('Resolve already in progress, ignoring click for game:', gameId);
        return;
    }
    
    // Clear any existing timeout for this game
    if (resolveTimeouts.has(gameId)) {
        clearTimeout(resolveTimeouts.get(gameId));
        resolveTimeouts.delete(gameId);
    }
    
    isResolving = true;
    console.log('Resolving game:', gameId, 'for account:', account);
    updateStatus('Loading... Checking game resolution...');
    
    socket.emit('resolveGame', { gameId, account });
    
    // Set timeout for this specific game resolution
    const timeoutId = setTimeout(() => {
        if (isResolving) {
            console.log(`Resolution timed out for game ${gameId}`);
            isResolving = false;
            updateStatus('Resolution timed out, please try again.');
            socket.emit('fetchResolvedGames', { account });
        }
    }, 30000);
    
    resolveTimeouts.set(gameId, timeoutId);
}

initializeUI({ 
    socket, 
    getAccount: () => account, 
    getResolvedGames: () => resolvedGames, 
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
        
        // Enhanced token processing with better error handling
        const tokenPromises = tokens.map(async (id) => {
            try {
                let uri = await nftContract.tokenURI(id);
                if (uri.startsWith('ipfs://')) {
                    uri = 'https://gateway.pinata.cloud/ipfs/' + uri.slice(7);
                }
                
                console.log(`Fetching metadata for token ${id}: ${uri}`);
                
                const response = await fetch(uri, {
                    timeout: 10000, // 10 second timeout
                    headers: {
                        'Accept': 'application/json'
                    }
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                
                const metadata = await response.json();
                let image = metadata.image;
                
                if (image && image.startsWith('ipfs://')) {
                    // Use reliable IPFS gateway
                    image = 'https://gateway.pinata.cloud/ipfs/' + image.slice(7);
                }
                
                return {
                    id: id.toString(),
                    image: image || 'https://via.placeholder.com/64?text=NFT'
                };
            } catch (error) {
                console.error(`Error processing token ${id}:`, error);
                return {
                    id: id.toString(),
                    image: 'https://via.placeholder.com/64?text=NFT'
                };
            }
        });
        
        // Wait for all tokens to be processed
        userTokens = await Promise.all(tokenPromises);
        
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
        image1: data.image1 || 'https://via.placeholder.com/64?text=NFT1',
        player2: data.player2, 
        tokenId2: data.tokenId2, 
        image2: data.image2 || 'https://via.placeholder.com/64?text=NFT2',
        resolved: false, 
        userResolved: { [account.toLowerCase()]: false }, 
        viewed: { [account.toLowerCase()]: false }
    });
    updateResultsModal(resolvedGames, account);
    updateStatus(`Game #${data.gameId} joined by ${data.player2.slice(0, 6)}...${data.player2.slice(-4)}`);
    await fetchUserTokens();
});

socket.on('resolvedGames', (games) => {
    console.log('Received resolvedGames:', games);
    resolvedGames = games.map(game => ({
        ...game,
        userResolved: game.userResolved || { [account.toLowerCase()]: false },
        viewed: game.viewed || { [account.toLowerCase()]: false },
        // Ensure images have fallbacks
        image1: game.image1 || 'https://via.placeholder.com/64?text=NFT1',
        image2: game.image2 || 'https://via.placeholder.com/64?text=NFT2'
    }));
    updateResultsModal(resolvedGames, account);
});

socket.on('gameResolution', async (data) => {
    console.log('Received gameResolution:', data);
    
    // Clear the timeout for this game
    if (resolveTimeouts.has(data.gameId)) {
        clearTimeout(resolveTimeouts.get(data.gameId));
        resolveTimeouts.delete(data.gameId);
    }
    
    if (data.error) {
        // Handle transient errors by retrying
        if (data.error === 'Game not resolved or no winner') {
            console.log(`Game ${data.gameId} not yet resolved, retrying...`);
            setTimeout(() => {
                if (account) {
                    socket.emit('fetchResolvedGames', { account });
                }
            }, 3000);
            return; // Keep loading state, don't show error
        }
        // Definitive errors (e.g., game not found)
        updateStatus(`Error resolving game #${data.gameId}: ${data.error}`);
        isResolving = false;
        return;
    }
    
    // Game resolved successfully
    isResolving = false;
    const win = account && data.winner && data.winner.toLowerCase() === account.toLowerCase();
    updateStatus(`Game #${data.gameId} resolved: ${win ? 'You Win!' : 'You Lose!'}`);
    
    // Enhanced video path handling
    let videoPath;
    if (win) {
        // Try multiple video sources
        videoPath = 'https://sketchyflipback.onrender.com/win.mp4'; // Use full URL
    } else {
        videoPath = 'https://sketchyflipback.onrender.com/lose.mp4'; // Use full URL
    }
    
    // Ensure images have proper fallbacks
    const image1 = data.image1 || 'https://via.placeholder.com/64?text=NFT1';
    const image2 = data.image2 || 'https://via.placeholder.com/64?text=NFT2';
    
    playResultVideo(
        videoPath,
        win ? 'You Win!' : 'You Lose!', 
        image1,
        image2
    );
    
    // Mark game as resolved in local state
    resolvedGames = resolvedGames.map(game => 
        game.gameId === data.gameId 
            ? { ...game, userResolved: { ...game.userResolved, [account.toLowerCase()]: true } }
            : game
    );
    
    // Fetch the latest unresolved games from backend
    socket.emit('fetchResolvedGames', { account });
    await fetchUserTokens();
    
    // Emit that this game has been resolved for this user
    socket.emit('markGameResolved', { gameId: data.gameId, account });
});

socket.on('disconnect', () => {
    console.log('Disconnected from backend');
    updateStatus('Disconnected from backend, attempting reconnect...');
    // Clear all pending timeouts
    resolveTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    resolveTimeouts.clear();
    isResolving = false;
});

socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    updateStatus(`Socket connection error: ${error.message}`);
    isResolving = false;
});

socket.on('reconnect', (attempt) => {
    console.log('Reconnected to backend after attempt:', attempt);
    if (account) {
        socket.emit('registerAddress', { address: account });
    }
    updateStatus('Reconnected to backend!');
    isResolving = false;
});

socket.on('reconnect_error', (error) => {
    console.error('Socket reconnection error:', error);
    updateStatus(`Socket reconnection error: ${error.message}`);
});