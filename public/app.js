import { gameABI, nftABI } from './abis.js';
import { initializeUI, showLoadingScreen, hideLoadingScreen, updateStatus, displayNFTsInModal, selectNFT, updateOpenGames, updateResultsModal, playResultVideo } from './ui.js';

const gameAddress = '0xf6b8d2E0d36669Ed82059713BDc6ACfABe11Fde6';
const nftAddress = '0x08533A2b16e3db03eeBD5b23210122f97dfcb97d';
const socket = io('https://sketchyflipback.onrender.com', {
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
});

let provider, signer, account, gameContract, gameContractWithSigner, nftContract;
let selectedTokenId = null;
let userTokens = [];
let resolvedGames = JSON.parse(localStorage.getItem('resolvedGames')) || [];
let isResolving = false;
let lastEventBlock = BigInt(localStorage.getItem('lastEventBlock') || '0');

async function getGameWinnerOnChain(gameId) {
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
        const event = gameContract.interface.parseLog(logs[0]);
        return {
            winner: event.args.winner.toLowerCase(),
            tokenId1: event.args.tokenId1.toString(),
            tokenId2: event.args.tokenId2.toString()
        };
    }
    return null;
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
    const game = resolvedGames.find(g => g.gameId === gameId);
    if (!game) {
        updateStatus('Game not found.');
        isResolving = false;
        return;
    }
    try {
        const chainResult = await getGameWinnerOnChain(gameId);
        if (chainResult) {
            const win = account && chainResult.winner === account.toLowerCase();
            game.winner = chainResult.winner;
            game.tokenId1 = chainResult.tokenId1;
            game.tokenId2 = chainResult.tokenId2;
            game.image1 = `https://f005.backblazeb2.com/file/sketchymilios/${chainResult.tokenId1}.png`;
            game.image2 = `https://f005.backblazeb2.com/file/sketchymilios/${chainResult.tokenId2}.png`;
            game.resolved = true;
            game.userResolved[account.toLowerCase()] = true;
            game.viewed[account.toLowerCase()] = true;
            playResultVideo(
                win ? '/win.mp4' : '/lose.mp4',
                win ? 'You Win!' : 'You Lose!',
                game.image1,
                game.image2
            );
            localStorage.setItem('resolvedGames', JSON.stringify(resolvedGames));
            updateResultsModal(resolvedGames, account);
            socket.emit('markGameResolved', { gameId, account });
            socket.emit('fetchResolvedGames', { account });
            await fetchUserTokens();
            isResolving = false;
            return;
        }
        updateStatus('Game not yet resolved on chain.');
    } catch (err) {
        console.error('Blockchain query error:', err);
        updateStatus(`Error resolving game: ${err.message}`);
    }
    isResolving = false;
}

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
        await fetchResolvedGames();
        updateResultsModal(resolvedGames, account);
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

async function fetchResolvedGames() {
    if (!account || !gameContract) return;
    try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(Number(lastEventBlock) + 1, currentBlock - 1000);
        const topic = ethers.utils.id('GameResolved(uint256,address,uint256,uint256)');
        const filter = {
            address: gameAddress,
            topics: [topic],
            fromBlock,
            toBlock: currentBlock
        };
        const logs = await provider.getLogs(filter);
        const newGames = [];
        for (const log of logs) {
            const event = gameContract.interface.parseLog(log);
            const gameId = event.args[0].toString();
            const winner = event.args[1].toLowerCase();
            const tokenId1 = event.args[2].toString();
            const tokenId2 = event.args[3].toString();
            const game = await gameContract.getGame(BigInt(gameId));
            const player1 = game.player1.toLowerCase();
            const player2 = game.player2.toLowerCase();
            if (player1 === account.toLowerCase() || player2 === account.toLowerCase()) {
                const existing = resolvedGames.find(g => g.gameId === gameId);
                if (!existing) {
                    const block = await provider.getBlock(log.blockNumber);
                    const localDate = new Date(block.timestamp * 1000).toLocaleString();
                    const result = winner === account.toLowerCase() ? 'Won' : 'Lost';
                    newGames.push({
                        gameId,
                        player1,
                        player2,
                        tokenId1,
                        tokenId2,
                        image1: `https://f005.backblazeb2.com/file/sketchymilios/${tokenId1}.png`,
                        image2: `https://f005.backblazeb2.com/file/sketchymilios/${tokenId2}.png`,
                        winner,
                        result,
                        localDate,
                        transactionHash: log.transactionHash,
                        resolved: true,
                        userResolved: { [account.toLowerCase()]: true },
                        viewed: { [account.toLowerCase()]: false }
                    });
                }
            }
        }
        resolvedGames = [...resolvedGames, ...newGames].reduce((acc, game) => {
            const existing = acc.find(g => g.gameId === game.gameId);
            if (!existing) {
                acc.push({
                    ...game,
                    userResolved: game.userResolved || { [account?.toLowerCase() || '']: false },
                    viewed: game.viewed || { [account?.toLowerCase() || '']: false }
                });
            } else if (!existing.viewed[account?.toLowerCase()]) {
                existing.viewed[account?.toLowerCase()] = game.viewed?.[account?.toLowerCase()] || false;
            }
            return acc;
        }, []);
        localStorage.setItem('resolvedGames', JSON.stringify(resolvedGames));
        localStorage.setItem('lastEventBlock', currentBlock.toString());
        lastEventBlock = BigInt(currentBlock);
        console.log('Fetched resolved games:', resolvedGames);
        socket.emit('fetchResolvedGames', { account }); // Keep backend sync
        updateResultsModal(resolvedGames, account);
    } catch (err) {
        console.error('Error fetching resolved games:', err);
        updateStatus(`Error fetching history: ${err.message}`);
    }
}

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
        viewed: { [account?.toLowerCase() || '']: false },
        localDate: new Date().toLocaleString()
    });
    localStorage.setItem('resolvedGames', JSON.stringify(resolvedGames));
    updateResultsModal(resolvedGames, account);
    updateStatus(`Game #${data.gameId} joined by ${data.player2.slice(0, 6)}...${data.player2.slice(-4)}`);
    await fetchUserTokens();
});

socket.on('resolvedGames', (games) => {
    console.log('Received resolvedGames:', games);
    const blockchainGames = resolvedGames.filter(g => g.resolved); // Keep blockchain-fetched resolved games
    const newGames = games.map(game => ({
        ...game,
        userResolved: game.userResolved || { [account?.toLowerCase() || '']: false },
        viewed: game.viewed || { [account?.toLowerCase() || '']: false },
        localDate: game.localDate || new Date(Number(game.createTimestamp || 0) * 1000).toLocaleString() || new Date().toLocaleString()
    }));
    resolvedGames = [...blockchainGames, ...newGames].reduce((acc, game) => {
        const existing = acc.find(g => g.gameId === game.gameId);
        if (!existing) {
            acc.push(game);
        } else if (!existing.viewed[account?.toLowerCase()]) {
            existing.viewed[account?.toLowerCase()] = game.viewed?.[account?.toLowerCase()] || false;
            existing.localDate = game.localDate || existing.localDate;
        }
        return acc;
    }, []);
    localStorage.setItem('resolvedGames', JSON.stringify(resolvedGames));
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
    const game = resolvedGames.find(g => g.gameId === data.gameId);
    if (game) {
        game.winner = data.winner.toLowerCase();
        game.resolved = true;
        game.userResolved[account.toLowerCase()] = true;
        game.viewed[account.toLowerCase()] = true;
        game.image1 = data.image1 || `https://f005.backblazeb2.com/file/sketchymilios/${data.tokenId1}.png`;
        game.image2 = data.image2 || `https://f005.backblazeb2.com/file/sketchymilios/${data.tokenId2}.png`;
        game.localDate = game.localDate || new Date().toLocaleString();
    } else {
        resolvedGames.push({
            gameId: data.gameId,
            player1: data.player1,
            player2: data.player2,
            tokenId1: data.tokenId1,
            tokenId2: data.tokenId2,
            image1: data.image1 || `https://f005.backblazeb2.com/file/sketchymilios/${data.tokenId1}.png`,
            image2: data.image2 || `https://f005.backblazeb2.com/file/sketchymilios/${data.tokenId2}.png`,
            winner: data.winner.toLowerCase(),
            resolved: true,
            userResolved: { [account.toLowerCase()]: true },
            viewed: { [account.toLowerCase()]: true },
            localDate: new Date().toLocaleString()
        });
    }
    playResultVideo(
        win ? '/win.mp4' : '/lose.mp4',
        win ? 'You Win!' : 'You Lose!',
        data.image1 || `https://f005.backblazeb2.com/file/sketchymilios/${data.tokenId1}.png`,
        data.image2 || `https://f005.backblazeb2.com/file/sketchymilios/${data.tokenId2}.png`
    );
    localStorage.setItem('resolvedGames', JSON.stringify(resolvedGames));
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

initializeUI({
    socket,
    getAccount: () => account,
    getResolvedGames: () => resolvedGames,
    getUserTokens: () => userTokens,
    setSelectedTokenId: (id) => { selectedTokenId = id; },
    resolveGame
});