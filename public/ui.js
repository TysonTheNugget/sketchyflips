let uiOptions = null;

let isPlayingResultVideo = false;

export function initializeUI({ socket, getAccount, getResolvedGames, getUserTokens, setSelectedTokenId, resolveGame }) {
    uiOptions = { socket, getAccount, getResolvedGames, getUserTokens, setSelectedTokenId, resolveGame };
   
    // Modal event listeners
    document.getElementById('infoButton').addEventListener('click', () => {
        console.log('Opening info modal');
        document.getElementById('infoModal').style.display = 'block';
    });

    document.getElementById('betButton').addEventListener('click', () => {
        console.log('Bet-A-Sketchy clicked, showing game interface');
        document.getElementById('mainMenu').classList.add('hidden');
        document.getElementById('gameInterface').classList.remove('hidden');
    });

    document.getElementById('selectNFTBtn').addEventListener('click', () => {
        console.log('Opening NFT selection modal');
        displayNFTsInModal(getUserTokens());
        document.getElementById('nftModal').style.display = 'block';
    });

    document.getElementById('resultsButton').addEventListener('click', async (e) => {
        e.stopPropagation();
        console.log('Results button clicked, opening modal');
        const games = await getResolvedGames();
        updateResultsModal(games, getAccount(), resolveGame);
        document.getElementById('resultsModal').style.display = 'block';
    });

    document.getElementById('infoModal').querySelector('.close').onclick = () => {
        document.getElementById('infoModal').style.display = 'none';
    };

    document.getElementById('nftModal').querySelector('.close').onclick = () => {
        document.getElementById('nftModal').style.display = 'none';
    };

    document.getElementById('resultsModal').querySelector('.close').onclick = () => {
        console.log('Closing results modal');
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
            console.log('Clicked outside results modal');
            document.getElementById('resultsModal').style.display = 'none';
        }
    };
}

export function showLoadingScreen() {
    console.log('Showing loading screen');
    const loadingScreen = document.getElementById('loadingScreen');
    loadingScreen.classList.remove('hide');
    loadingScreen.classList.add('show');
}

export function hideLoadingScreen() {
    console.log('Hiding loading screen');
    const loadingScreen = document.getElementById('loadingScreen');
    loadingScreen.classList.remove('show');
    loadingScreen.classList.add('hide');
}

export function updateStatus(message) {
    console.log('Status update:', message);
    document.getElementById('status').textContent = message;
}

export function formatTimeRemaining(seconds) {
    if (seconds <= 0) return 'Now';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours > 0 ? hours + 'h ' : ''}${minutes > 0 ? minutes + 'm ' : ''}${secs}s`;
}

export function displayNFTsInModal(userTokens) {
    console.log('Displaying NFTs in modal, count:', userTokens.length);
    const nftGrid = document.getElementById('nftGrid');
    nftGrid.innerHTML = '';
    if (userTokens.length === 0) {
        nftGrid.innerHTML = '<p class="text-center text-xs">No NFTs available</p>';
        return;
    }
    userTokens.forEach(token => {
        console.log('Creating NFT item for token ID:', token.id);
        const div = document.createElement('div');
        div.className = 'nft-item';
        const img = document.createElement('img');
        img.src = token.image;
        img.alt = `NFT #${token.id}`;
        img.style.pointerEvents = 'none';
        const p = document.createElement('p');
        p.className = 'text-xs';
        p.textContent = `#${token.id}`;
        div.appendChild(img);
        div.appendChild(p);
        div.addEventListener('click', (e) => {
            e.stopPropagation();
            console.log('NFT clicked:', token.id);
            selectNFT(token.id, token.image);
        });
        nftGrid.appendChild(div);
    });
}

export function selectNFT(tokenId, image) {
    console.log('Selecting NFT with ID:', tokenId);
    if (uiOptions && uiOptions.setSelectedTokenId) {
        uiOptions.setSelectedTokenId(tokenId);
    } else {
        console.error('setSelectedTokenId is not available');
    }
    document.getElementById('selectedNFT').innerHTML = `<img src="${image}" alt="NFT #${tokenId}" class="w-8 h-8 inline-block mr-1 rounded border border-orange-500"><p class="inline text-xs">NFT #${tokenId}</p>`;
    document.getElementById('nftModal').style.display = 'none';
}

export function updateOpenGames(games, account) {
    console.log('Updating open games list with:', games);
    const openGamesList = document.getElementById('openGamesList');
    openGamesList.innerHTML = '';
    if (!games || games.length === 0) {
        console.log('No open games to display');
        openGamesList.innerHTML = '<li class="text-center text-xs opacity-70">No open games.</li>';
        return;
    }
    games.forEach(game => {
        console.log('Rendering game:', game.id, 'Player:', game.player1, 'Token:', game.tokenId1);
        const isMine = account && game.player1.toLowerCase() === account.toLowerCase();
        const currentTime = Math.floor(Date.now() / 1000);
        const timeUntilCancel = Number(game.createTimestamp) + 3600 - currentTime;
        const canCancel = isMine && timeUntilCancel <= 0;
        let actionButton = '';
        if (isMine) {
            actionButton = canCancel
                ? `<button class="neon-button py-0.5 px-1 text-xs cancel-game-btn" data-game-id="${game.id}">Cancel</button>`
                : `<span class="text-xs opacity-70">Cancel in ${formatTimeRemaining(timeUntilCancel)}</span>`;
        } else if (account) {
            actionButton = `<button class="neon-button py-0.5 px-1 text-xs join-game-btn" data-game-id="${game.id}">Join</button>`;
        } else {
            actionButton = `<span class="text-xs opacity-70">Connect wallet to join</span>`;
        }
        const li = document.createElement('li');
        li.className = 'game-card p-2 flex justify-between items-center';
        li.innerHTML = `
            <div class="flex items-center">
                <img src="${game.image}" alt="NFT #${game.tokenId1}" class="w-8 h-8 mr-2 rounded shadow border border-orange-500">
                <div>
                    <span class="font-bold text-xs">Game #${game.id}</span><br>
                    <span class="text-xs opacity-70">NFT #${game.tokenId1} | ${game.createdAt}</span>
                </div>
            </div>
            ${actionButton}`;
        openGamesList.appendChild(li);
    });
    // Add event listeners for dynamically created buttons
    document.querySelectorAll('.join-game-btn').forEach(button => {
        button.addEventListener('click', () => {
            const gameId = button.getAttribute('data-game-id');
            window.joinGameFromList(gameId);
        });
    });
    document.querySelectorAll('.cancel-game-btn').forEach(button => {
        button.addEventListener('click', () => {
            const gameId = button.getAttribute('data-game-id');
            window.cancelUnjoinedFromList(gameId);
        });
    });
}

export function updateResultsModal(resolvedGames, account, resolveGame) {
    console.log('Updating results modal with:', resolvedGames);
    const resultsModalList = document.getElementById('resultsModalList');
    resultsModalList.innerHTML = '';
    if (!account) {
        resultsModalList.innerHTML = '<li class="text-center text-xs opacity-70">Connect wallet to view games.</li>';
        document.getElementById('resultsNotification').classList.add('hidden');
        return;
    }
    if (resolvedGames.length === 0) {
        resultsModalList.innerHTML = '<li class="text-center text-xs opacity-70">No games played.</li>';
        document.getElementById('resultsNotification').classList.add('hidden');
        return;
    }
    const accountLower = account.toLowerCase();
    document.getElementById('resultsButton').classList.remove('hidden');
    document.getElementById('resultsNotification').textContent = resolvedGames.length;
    document.getElementById('resultsNotification').classList.remove('hidden');

    resolvedGames.forEach(game => {
        const isPlayer1 = game.player1 === accountLower;
        const opponent = isPlayer1 ? (game.player2 || 'N/A') : game.player1;
        const userChoice = game.choice ? 'Heads' : 'Tails';
        const resultText = game.resolved ? (game.winner === accountLower ? 'Win' : 'Loss') : 'Pending';
        const resolveButton = game.resolved
            ? `<button class="neon-button py-0.5 px-1 text-xs resolve-game-btn" data-game-id="${game.gameId}">Resolve</button>`
            : `<span class="text-xs opacity-70">Pending</span>`;
        const li = document.createElement('li');
        li.className = 'game-card p-2 flex justify-between items-center';
        li.innerHTML = `
            <div>
                <div class="font-bold text-xs">Game #${game.gameId.slice(0, 6)}...</div>
                <div class="text-xs">Opponent: ${opponent.slice(0, 6)}...${opponent.slice(-4)}</div>
                <div class="text-xs">Your NFT: #${isPlayer1 ? game.tokenId1 : game.tokenId2 || 'N/A'}</div>
                <div class="text-xs">Opponent NFT: #${isPlayer1 ? game.tokenId2 || 'N/A' : game.tokenId1}</div>
                <div class="text-xs">Your Choice: ${userChoice}</div>
                <div class="text-xs">Result: ${resultText}</div>
                <div class="text-xs opacity-70">Created: ${new Date(Number(game.createTimestamp) * 1000).toLocaleString()}</div>
                ${game.joinTimestamp ? `<div class="text-xs opacity-70">Joined: ${new Date(Number(game.joinTimestamp) * 1000).toLocaleString()}</div>` : ''}
            </div>
            ${resolveButton}`;
        resultsModalList.appendChild(li);
    });

    document.querySelectorAll('.resolve-game-btn').forEach(button => {
        button.addEventListener('click', () => {
            if (!uiOptions.getAccount()) {
                console.warn('No account connected, skipping resolve');
                updateStatus('Connect wallet to resolve games.');
                return;
            }
            const gameId = button.getAttribute('data-game-id');
            uiOptions.resolveGame(gameId);
        });
    });
}

export function playResultVideo(src, text, image1, image2) {
    console.log('Playing result video:', src, text, 'Images:', image1, image2);
    isPlayingResultVideo = true;
    const video = document.getElementById('resultVideo');
    const overlay = document.getElementById('videoOverlay');
    const resultText = document.getElementById('resultText');
    const animationNFTs = document.getElementById('animationNFTs');
    const validImage1 = image1 && image1 !== 'undefined' ? image1 : 'https://via.placeholder.com/64';
    const validImage2 = image2 && image2 !== 'undefined' ? image2 : 'https://via.placeholder.com/64';
    animationNFTs.innerHTML = `
        <img src="${validImage1}" alt="NFT1" onerror="this.src='https://via.placeholder.com/64';">
        <img src="${validImage2}" alt="NFT2" onerror="this.src='https://via.placeholder.com/64';">
    `;
    video.src = src;
    resultText.textContent = text;
    overlay.classList.remove('hidden', 'fade-out');
    setTimeout(() => {
        overlay.classList.add('fade-in');
    }, 10);
    video.play().catch(error => {
        console.error('Error playing video:', error);
        updateStatus(`Error playing result video: ${error.message}`);
        overlay.classList.remove('fade-in');
        overlay.classList.add('fade-out');
        setTimeout(() => {
            overlay.classList.add('hidden');
            overlay.classList.remove('fade-out');
            animationNFTs.innerHTML = '';
        }, 800);
        isPlayingResultVideo = false;
    });
    video.onended = () => {
        console.log('Video ended, hiding overlay');
        overlay.classList.remove('fade-in');
        overlay.classList.add('fade-out');
        setTimeout(() => {
            overlay.classList.add('hidden');
            overlay.classList.remove('fade-out');
            animationNFTs.innerHTML = '';
        }, 800);
        isPlayingResultVideo = false;
    };
}