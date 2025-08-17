import { gameABI, nftABI } from './abis.js';
import { initializeUI, showLoadingScreen, hideLoadingScreen, updateStatus, displayNFTsInModal, selectNFT, updateOpenGames, updateResultsModal, playResultVideo } from './ui.js';

const gameAddress = '0xf6b8d2E0d36669Ed82059713BDc6ACfABe11Fde6';
const nftAddress = '0x08533A2b16e3db03eeBD5b23210122f97dfcb97d';

let provider, signer, account, gameContract, gameContractWithSigner, nftContract;
let selectedTokenId = null;
let userTokens = [];
let resolvedGames = JSON.parse(localStorage.getItem('resolvedGames')) || [];
let isResolving = false;
let lastEventBlock = BigInt(localStorage.getItem('lastEventBlock') || '0');

async function initEthers() {
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
        await fetchUserTokens(true);
        await fetchResolvedGames();
        await refreshOpenGames();
        setInterval(refreshOpenGames, 10000); // Poll open games every 10s
        setInterval(fetchResolvedGames, 30000); // Poll history every 30s
        updateResultsModal(resolvedGames, account);
    } catch (error) {
        console.error('Error connecting wallet:', error);
        updateStatus(`Connection error: ${error.message}`);
        if (error.code === -32603) {
            updateStatus('RPC Error: Disconnect MetaMask from the website and reconnect.');
        }
    }
}

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

async function handleCreateGame() {
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
        await refreshOpenGames();
    } catch (error) {
        console.error('Error creating game:', error);
        updateStatus(`Error creating game: ${error.message}`);
        if (error.code === -32603) {
            updateStatus('RPC Error: Disconnect MetaMask from the website and reconnect.');
        }
    }
}

async function joinGameFromList(gameId) {
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
        await refreshOpenGames();
    } catch (error) {
        console.error('Error joining game:', error);
        updateStatus(`Error joining: ${error.message}`);
        if (error.code === -32603) {
            updateStatus('RPC Error: Disconnect MetaMask from the website and reconnect.');
        }
    }
}

async function cancelUnjoinedFromList(gameId) {
    if (!gameContractWithSigner) return updateStatus('Connect wallet first.');
    try {
        updateStatus('Canceling game...');
        const tx = await gameContractWithSigner.cancelUnjoinedGame(gameId);
        await tx.wait();
        updateStatus('Game canceled.');
        await fetchUserTokens();
        await refreshOpenGames();
    } catch (error) {
        console.error('Error canceling unjoined game:', error);
        updateStatus(`Error canceling: ${error.message}`);
        if (error.code === -32603) {
            updateStatus('RPC Error: Disconnect MetaMask from the website and reconnect.');
        }
    }
}

async function refreshOpenGames() {
    try {
        const openGameIds = await gameContract.getOpenGames();
        const games = [];
        for (const gameId of openGameIds) {
            const game = await gameContract.getGame(gameId);
            games.push({
                id: gameId.toString(),
                player1: game.player1,
                tokenId1: game.tokenId1.toString(),
                image: `https://f005.backblazeb2.com/file/sketchymilios/${game.tokenId1}.png`,
                createdAt: new Date().toLocaleString()
            });
        }
        updateOpenGames(games, account);
    } catch (error) {
        console.error('Error fetching open games:', error);
        updateStatus(`Error fetching open games: ${error.message}`);
    }
}

async function fetchResolvedGames() {
    if (!account || !gameContract) return;
    try {
        const currentBlock = await provider.getBlockNumber();
        const fromBlock = Number(lastEventBlock) + 1;
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
                        viewed: false
                    });
                }
            }
        }
        resolvedGames = [...resolvedGames, ...newGames].reduce((acc, game) => {
            const existing = acc.find(g => g.gameId === game.gameId);
            if (!existing) acc.push(game);
            return acc;
        }, []);
        localStorage.setItem('resolvedGames', JSON.stringify(resolvedGames));
        localStorage.setItem('lastEventBlock', currentBlock.toString());
        lastEventBlock = BigInt(currentBlock);
        console.log('Fetched resolved games:', resolvedGames);
        updateResultsModal(resolvedGames, account);
    } catch (err) {
        console.error('Error fetching resolved games:', err);
        updateStatus(`Error fetching history: ${err.message}`);
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
    const game = resolvedGames.find(g => g.gameId === gameId);
    if (!game) {
        updateStatus('Game not found.');
        isResolving = false;
        return;
    }
    const win = game.result === 'Won';
    playResultVideo(
        win ? '/assets/win.mp4' : '/assets/lose.mp4',
        win ? 'You Win!' : 'You Lose!',
        game.image1,
        game.image2
    );
    game.viewed = true;
    localStorage.setItem('resolvedGames', JSON.stringify(resolvedGames));
    updateResultsModal(resolvedGames, account);
    isResolving = false;
}

document.getElementById('connectWallet').addEventListener('click', initEthers);
document.getElementById('createGameBtn').addEventListener('click', handleCreateGame);
window.joinGameFromList = joinGameFromList;
window.cancelUnjoinedFromList = cancelUnjoinedFromList;
window.fetchResolvedGames = fetchResolvedGames;

initializeUI({
    getAccount: () => account,
    getResolvedGames: () => resolvedGames,
    getUserTokens: () => userTokens,
    setSelectedTokenId: (id) => { selectedTokenId = id; },
    resolveGame
});