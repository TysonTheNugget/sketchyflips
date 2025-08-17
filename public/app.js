import { gameABI, nftABI } from './abis.js';
import { initializeUI, showLoadingScreen, hideLoadingScreen, updateStatus, displayNFTsInModal, selectNFT, updateOpenGames, updateResultsModal, playResultVideo } from './ui.js';

const gameAddress = '0xf6b8d2E0d36669Ed82059713BDc6ACfABe11Fde6';
const nftAddress = '0x08533A2b16e3db03eeBD5b23210122f97dfcb97d';

let provider, signer, account, gameContract, gameContractWithSigner, nftContract;
let selectedTokenId = null;
let userTokens = [];
let resolvedGames = JSON.parse(localStorage.getItem('resolvedGames')) || [];
let createdGames = JSON.parse(localStorage.getItem('createdGames')) || [];
let joinedGames = JSON.parse(localStorage.getItem('joinedGames')) || [];
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
    const game = [...resolvedGames, ...createdGames, ...joinedGames].find(g => g.gameId === gameId);
    if (!game) {
        updateStatus('Game not found.');
        isResolving = false;
        return;
    }
    if (!game.result) {
        updateStatus('Game not yet resolved.');
        isResolving = false;
        return;
    }
    const win = game.result === 'Won';
    playResultVideo(
        win ? '/win.mp4' : '/lose.mp4',
        win ? 'You Win!' : 'You Lose!',
        game.image1,
        game.image2 || 'https://via.placeholder.com/64'
    );
    game.viewed = true;
    localStorage.setItem('resolvedGames', JSON.stringify(resolvedGames));
    localStorage.setItem('createdGames', JSON.stringify(createdGames));
    localStorage.setItem('joinedGames', JSON.stringify(joinedGames));
    updateResultsModal([...resolvedGames, ...createdGames, ...joinedGames], account);
    isResolving = false;
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
        updateResultsModal([...resolvedGames, ...createdGames, ...joinedGames], account);
        setInterval(fetchResolvedGames, 30000);
    } catch (error) {
        console.error('Error connecting wallet:', error);
        updateStatus(`Connection error: ${error.message}`);
        if (error.code === -32603) {
            updateStatus('RPC Error: Disconnect MetaMask from the website and reconnect.');
        }
    }
}

document.getElementById('createGameBtn').addEventListener('click', async () => {
    if (!gameContractWithSigner) return updateStatus('Connect wallet first.');
    if (!selectedTokenId) return updateStatus('Select an NFT to bet.');
    try {
        updateStatus('Approving NFT...');
        const approveTx = await nftContract.approve(gameAddress, selectedTokenId);
        await approveTx.wait();
        updateStatus('Creating game...');
        const tx = await gameContractWithSigner.createGame(selectedTokenId);
        const receipt = await tx.wait();
        const gameId = receipt.events.find(e => e.event === 'GameCreated')?.args.gameId?.toString();
        if (gameId) {
            createdGames.push({
                gameId,
                player1: account.toLowerCase(),
                tokenId1: selectedTokenId.toString(),
                image1: `https://f005.backblazeb2.com/file/sketchymilios/${selectedTokenId}.png`,
                player2: null,
                tokenId2: null,
                image2: null,
                result: null,
                localDate: new Date().toLocaleString(),
                viewed: false,
                transactionHash: receipt.transactionHash
            });
            localStorage.setItem('createdGames', JSON.stringify(createdGames));
        }
        updateStatus('Game created! Waiting for join...');
        await fetchUserTokens();
        selectedTokenId = null;
        document.getElementById('selectedNFT').innerHTML = 'Your Sketchy';
        updateResultsModal([...resolvedGames, ...createdGames, ...joinedGames], account);
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
        const receipt = await tx.wait();
        const game = await gameContract.getGame(BigInt(gameId));
        joinedGames.push({
            gameId,
            player1: game.player1.toLowerCase(),
            player2: account.toLowerCase(),
            tokenId1: game.tokenId1.toString(),
            tokenId2: selectedTokenId.toString(),
            image1: `https://f005.backblazeb2.com/file/sketchymilios/${game.tokenId1}.png`,
            image2: `https://f005.backblazeb2.com/file/sketchymilios/${selectedTokenId}.png`,
            result: null,
            localDate: new Date().toLocaleString(),
            viewed: false,
            transactionHash: receipt.transactionHash
        });
        localStorage.setItem('joinedGames', JSON.stringify(joinedGames));
        updateStatus('Joined! Waiting for result...');
        await fetchUserTokens();
        selectedTokenId = null;
        document.getElementById('selectedNFT').innerHTML = 'Your Sketchy';
        updateResultsModal([...resolvedGames, ...createdGames, ...joinedGames], account);
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
        createdGames = createdGames.filter(g => g.gameId !== gameId);
        localStorage.setItem('createdGames', JSON.stringify(createdGames));
        updateStatus('Game canceled.');
        await fetchUserTokens();
        updateResultsModal([...resolvedGames, ...createdGames, ...joinedGames], account);
    } catch (error) {
        console.error('Error canceling unjoined game:', error);
        updateStatus(`Error canceling: ${error.message}`);
        if (error.code === -32603) {
            updateStatus('RPC Error: Disconnect MetaMask from the website and reconnect.');
        }
    }
};

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
                        viewed: false
                    });
                }
            }
        }
        // Move resolved created/joined games to resolvedGames
        createdGames = createdGames.filter(cg => !newGames.some(ng => ng.gameId === cg.gameId));
        joinedGames = joinedGames.filter(jg => !newGames.some(ng => ng.gameId === jg.gameId));
        resolvedGames = [...resolvedGames, ...newGames].reduce((acc, game) => {
            const existing = acc.find(g => g.gameId === game.gameId);
            if (!existing) acc.push(game);
            return acc;
        }, []);
        localStorage.setItem('resolvedGames', JSON.stringify(resolvedGames));
        localStorage.setItem('createdGames', JSON.stringify(createdGames));
        localStorage.setItem('joinedGames', JSON.stringify(joinedGames));
        localStorage.setItem('lastEventBlock', currentBlock.toString());
        lastEventBlock = BigInt(currentBlock);
        console.log('Fetched resolved games:', resolvedGames);
        updateResultsModal([...resolvedGames, ...createdGames, ...joinedGames], account);
    } catch (err) {
        console.error('Error fetching resolved games:', err);
        updateStatus(`Error fetching history: ${err.message}`);
    }
}

document.getElementById('connectWallet').addEventListener('click', initEthers);
initializeUI({
    getAccount: () => account,
    getResolvedGames: () => [...resolvedGames, ...createdGames, ...joinedGames],
    getUserTokens: () => userTokens,
    setSelectedTokenId: (id) => { selectedTokenId = id; },
    resolveGame
});