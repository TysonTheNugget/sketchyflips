let uiOptions = null;
let isPlayingResultVideo = false;

export function initializeUI({ getAccount, getResolvedGames, getUserTokens, setSelectedTokenId, resolveGame }) {
  uiOptions = { getAccount, getResolvedGames, getUserTokens, setSelectedTokenId, resolveGame };

  // Modal event listeners
  document.getElementById('infoButton').addEventListener('click', () => {
    document.getElementById('infoModal').style.display = 'block';
  });

  document.getElementById('betButton').addEventListener('click', () => {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('gameInterface').classList.remove('hidden');
  });

  document.getElementById('selectNFTBtn').addEventListener('click', () => {
    displayNFTsInModal(getUserTokens());
    document.getElementById('nftModal').style.display = 'block';
  });

  document.getElementById('resultsButton').addEventListener('click', (e) => {
    e.stopPropagation();
    updateResultsModal(getResolvedGames(), getAccount(), resolveGame);
    document.getElementById('resultsModal').style.display = 'block';
  });

  document.getElementById('infoModal').querySelector('.close').onclick = () => {
    document.getElementById('infoModal').style.display = 'none';
  };

  document.getElementById('nftModal').querySelector('.close').onclick = () => {
    document.getElementById('nftModal').style.display = 'none';
  };

  document.getElementById('resultsModal').querySelector('.close').onclick = () => {
    document.getElementById('resultsModal').style.display = 'none';
  };

  window.onclick = (event) => {
    if (event.target === document.getElementById('infoModal')) {
      document.getElementById('infoModal').style.display = 'none';
    }
    if (event.target === document.getElementById('nftModal')) {
      document.getElementById('nftModal').style.display = 'none';
    }
    if (event.target === document.getElementById('resultsModal')) {
      document.getElementById('resultsModal').style.display = 'none';
    }
  };
}

export function showLoadingScreen() {
  const loadingScreen = document.getElementById('loadingScreen');
  loadingScreen.classList.remove('hide');
  loadingScreen.classList.add('show');
}

export function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loadingScreen');
  loadingScreen.classList.remove('show');
  loadingScreen.classList.add('hide');
}

export function updateStatus(message) {
  document.getElementById('status').textContent = message;
}

export function displayNFTsInModal(tokenIds) {
  const nftList = document.getElementById('nftList');
  nftList.innerHTML = '';
  tokenIds.forEach((tokenId) => {
    const div = document.createElement('div');
    div.className = 'nft-item';
    div.innerHTML = `
      <img src="https://f005.backblazeb2.com/file/sketchymilios/${tokenId}.png" alt="Mymilio #${tokenId}" onerror="this.src='https://via.placeholder.com/64?text=NF';" />
      <p>Mymilio #${tokenId}</p>
    `;
    div.onclick = () => {
      uiOptions.setSelectedTokenId(tokenId);
      document.getElementById('selectedNFT').innerHTML = `Selected NFT: Mymilio #${tokenId}`;
      document.getElementById('nftModal').style.display = 'none';
    };
    nftList.appendChild(div);
  });
}

export function updateOpenGames(games, account) {
  const openGamesList = document.getElementById('openGamesList');
  openGamesList.innerHTML = '';
  games.forEach((game) => {
    const div = document.createElement('div');
    div.className = 'game-card flex items-center space-x-2 p-2';
    div.innerHTML = `
      <img src="${game.image1}" alt="Mymilio #${game.tokenId1}" class="w-12 h-12" onerror="this.src='https://via.placeholder.com/64?text=NF';" />
      <div>
        <p>Game #${game.gameId}</p>
        <p>Player 1: ${game.player1.slice(0, 6)}...${game.player1.slice(-4)}</p>
      </div>
      <button class="neon-button text-sm py-1 px-2" onclick="handleJoinGame(${game.gameId})">Join</button>
    `;
    openGamesList.appendChild(div);
  });
}

export function updateResultsModal(games, account, resolveGame) {
  const resultsModalList = document.getElementById('resultsModalList');
  resultsModalList.innerHTML = '';
  const unresolvedCount = games.filter(g => !g.viewed).length;
  document.getElementById('resultsNotification').textContent = unresolvedCount > 0 ? unresolvedCount : '';
  games.forEach((game) => {
    const li = document.createElement('li');
    li.className = 'game-card flex items-center space-x-2 p-2';
    li.innerHTML = `
      <img src="https://f005.backblazeb2.com/file/sketchymilios/${game.tokenId1}.png" alt="Mymilio #${game.tokenId1}" class="w-8 h-8" onerror="this.src='https://via.placeholder.com/32?text=NF';" />
      <img src="https://f005.backblazeb2.com/file/sketchymilios/${game.tokenId2}.png" alt="Mymilio #${game.tokenId2}" class="w-8 h-8" onerror="this.src='https://via.placeholder.com/32?text=NF';" />
      <div class="flex-1">
        <p>Game #${game.gameId}: ${game.viewed ? `<span class="${game.result === 'Won' ? 'text-green-500' : 'text-red-500'}">You ${game.result}!</span>` : 'Result Pending'}</p>
        <p class="text-gray-400 text-xs">Date: ${game.localDate}</p>
      </div>
      <button class="neon-button text-xs py-1 px-2 resolve-game-btn" data-game-id="${game.gameId}">${game.viewed ? 'View' : 'Resolve'}</button>
    `;
    resultsModalList.appendChild(li);
  });
  // Add refresh button if not present
  if (!document.getElementById('refreshHistoryBtn')) {
    const refreshBtn = document.createElement('button');
    refreshBtn.id = 'refreshHistoryBtn';
    refreshBtn.className = 'neon-button text-sm py-1 px-2 mt-2 w-full';
    refreshBtn.textContent = 'Refresh History';
    refreshBtn.onclick = () => fetchResolvedGames(); // Assume fetchResolvedGames is global or exposed
    resultsModalList.after(refreshBtn);
  }
  // Add event listeners for resolve buttons
  document.querySelectorAll('.resolve-game-btn').forEach(button => {
    button.addEventListener('click', () => {
      const gameId = button.getAttribute('data-game-id');
      resolveGame(gameId);
    });
  });
}

export function playResultVideo(src, text, image1, image2) {
  isPlayingResultVideo = true;
  const video = document.getElementById('resultVideo');
  const overlay = document.getElementById('videoOverlay');
  const resultText = document.getElementById('resultText');
  const animationNFTs = document.getElementById('animationNFTs');
  animationNFTs.innerHTML = `
    <img src="${image1}" alt="NFT1" onerror="this.src='https://via.placeholder.com/64';" />
    <img src="${image2}" alt="NFT2" onerror="this.src='https://via.placeholder.com/64';" />
  `;
  video.src = src;
  resultText.textContent = text;
  resultText.className = text === 'You Win!' ? 'text-green-500' : 'text-red-500';
  overlay.classList.remove('hidden', 'fade-out');
  setTimeout(() => overlay.classList.add('fade-in'), 10);
  video.play().catch(err => {
    updateStatus(`Video error: ${err.message}`);
    overlay.classList.add('hidden');
    isPlayingResultVideo = false;
  });
  video.onended = () => {
    overlay.classList.remove('fade-in');
    overlay.classList.add('fade-out');
    setTimeout(() => {
      overlay.classList.add('hidden');
      animationNFTs.innerHTML = '';
      isPlayingResultVideo = false;
    }, 800);
  };
}