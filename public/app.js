import { gameABI, nftABI } from './abis.js';
import { initializeUI, showLoadingScreen, hideLoadingScreen, updateStatus, displayNFTsInModal, selectNFT, updateOpenGames, updateResultsModal, playResultVideo } from './ui.js';

const gameAddress = '0xf6b8d2E0d36669Ed82059713BDcKapfABe11Fde6';
const nftAddress = '0x08533A2b16e3db03eeBD5b23210122f97dfcb97d';

let provider, signer, account, gameContract, gameContractWithSigner, nftContract;
let selectedTokenId = null;
let userTokens = [];
let resolvedGames = JSON.parse(localStorage.getItem('resolvedGames')) || [];
let isResolving = false;
let lastEventBlock = BigInt(localStorage.getItem('lastEventBlock') || '0');

async function initEthers() {
  if (window.ethereum) {
    provider = new ethers.providers.Web3Provider(window.ethereum);
    await window.ethereum.request({ method: 'eth_requestAccounts' });
    signer = provider.getSigner();
    account = await signer.getAddress();
    gameContract = new ethers.Contract(gameAddress, gameABI, provider);
    gameContractWithSigner = gameContract.connect(signer);
    nftContract = new ethers.Contract(nftAddress, nftABI, signer);
    document.getElementById('account').textContent = `Account: ${account.slice(0, 6)}...${account.slice(-4)}`;
    updateStatus('Wallet connected!');
    await fetchUserTokens();
    await fetchResolvedGames();
    await refreshOpenGames();
    setInterval(refreshOpenGames, 10000); // Poll open games every 10s
    setInterval(fetchResolvedGames, 30000); // Poll history every 30s
  } else {
    updateStatus('Please install MetaMask!');
  }
}

async function fetchUserTokens() {
  try {
    showLoadingScreen();
    userTokens = await nftContract.tokensOfOwner(account);
    displayNFTsInModal(userTokens);
    hideLoadingScreen();
  } catch (err) {
    updateStatus(`Error fetching NFTs: ${err.message}`);
    hideLoadingScreen();
  }
}

async function handleApproveAll() {
  try {
    const tx = await nftContract.setApprovalForAll(gameAddress, true);
    await tx.wait();
    updateStatus('Approval successful!');
  } catch (err) {
    updateStatus(`Approval error: ${err.message}`);
  }
}

async function isApproved() {
  return await nftContract.isApprovedForAll(account, gameAddress);
}

async function handleCreateGame() {
  if (!selectedTokenId) return updateStatus('Select an NFT first!');
  if (!(await isApproved())) {
    updateStatus('Approving contract...');
    await handleApproveAll();
  }
  try {
    const tx = await gameContractWithSigner.createGame(selectedTokenId);
    await tx.wait();
    updateStatus('Game created!');
    await refreshOpenGames();
  } catch (err) {
    updateStatus(`Create game error: ${err.message}`);
  }
}

async function handleJoinGame(gameId) {
  if (!selectedTokenId) return updateStatus('Select an NFT first!');
  if (!(await isApproved())) {
    updateStatus('Approving contract...');
    await handleApproveAll();
  }
  try {
    const tx = await gameContractWithSigner.joinGame(gameId, selectedTokenId);
    await tx.wait();
    updateStatus(`Joined game #${gameId}!`);
    await refreshOpenGames();
  } catch (err) {
    updateStatus(`Join error: ${err.message}`);
  }
}

async function refreshOpenGames() {
  try {
    const openGameIds = await gameContract.getOpenGames();
    const games = [];
    for (const gameId of openGameIds) {
      const game = await gameContract.getGame(gameId);
      games.push({
        gameId: gameId.toString(),
        player1: game.player1,
        tokenId1: game.tokenId1.toString(),
        image1: `https://f005.backblazeb2.com/file/sketchymilios/${game.tokenId1}.png`
      });
    }
    updateOpenGames(games, account);
  } catch (err) {
    updateStatus(`Error fetching open games: ${err.message}`);
  }
}

async function fetchResolvedGames() {
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
          resolvedGames.push({
            gameId,
            player1,
            player2,
            tokenId1,
            tokenId2,
            winner,
            result,
            localDate,
            transactionHash: log.transactionHash,
            viewed: false // Mimics 'resolved' in working code: false until viewed
          });
        }
      }
    }
    localStorage.setItem('lastEventBlock', currentBlock.toString());
    localStorage.setItem('resolvedGames', JSON.stringify(resolvedGames));
    updateResultsModal(resolvedGames, account);
  } catch (err) {
    updateStatus(`Error fetching history: ${err.message}`);
  }
}

async function resolveGame(gameId) {
  if (isResolving) return;
  isResolving = true;
  const game = resolvedGames.find(g => g.gameId === gameId);
  if (!game) {
    updateStatus('Game not found.');
    isResolving = false;
    return;
  }
  const win = game.result === 'Won';
  playResultVideo(
    win ? '/win.mp4' : '/lose.mp4',
    win ? 'You Win!' : 'You Lose!',
    `https://f005.backblazeb2.com/file/sketchymilios/${game.tokenId1}.png`,
    `https://f005.backblazeb2.com/file/sketchymilios/${game.tokenId2}.png`
  );
  game.viewed = true;
  localStorage.setItem('resolvedGames', JSON.stringify(resolvedGames));
  updateResultsModal(resolvedGames, account);
  isResolving = false;
}

// Initialize
document.getElementById('connectWalletBtn').addEventListener('click', initEthers);
document.getElementById('createGameBtn').addEventListener('click', handleCreateGame);
initializeUI({
  getAccount: () => account,
  getResolvedGames: () => resolvedGames,
  getUserTokens: () => userTokens,
  setSelectedTokenId: (id) => { selectedTokenId = id; },
  resolveGame
});