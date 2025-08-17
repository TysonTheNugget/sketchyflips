let uiOptions = null;
let isPlayingResultVideo = false;

export function initializeUI({ socket, getAccount, getResolvedGames, getUserTokens, setSelectedTokenId, resolveGame }) {
    uiOptions = { socket, getAccount, getResolvedGames, getUserTokens, setSelectedTokenId, resolveGame };

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

    document.getElementById('resultsButton').addEventListener('click', (e) => {
        e.stopPropagation();
        console.log('Results button clicked, opening modal');
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
        console.log('Closing results modal');
        const currentAccount = getAccount();
        if (currentAccount) {
            const games = getResolvedGames();
            games.forEach(game => {
                if (game.resolved) game.viewed = true;
            });
            localStorage.setItem('notifications', JSON.stringify(games.filter(g => g.resolved)));
            localStorage.setItem('createdGames', JSON.stringify(games.filter(g => !g.resolved && g.player1.toLowerCase() === currentAccount.toLowerCase())));
            localStorage.setItem('joinedGames', JSON.stringify(games.filter(g => !g.resolved && g.player2 && g.player2.toLowerCase() === currentAccount.toLowerCase())));
        }
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
            const currentAccount = getAccount();
            if (currentAccount) {
                const games = getResolvedGames();
                games.forEach(game => {
                    if (game.resolved) game.viewed = true;
                });
                localStorage.setItem('notifications', JSON.stringify(games.filter(g => g.resolved)));
                localStorage.setItem('createdGames', JSON.stringify(games.filter(g => !g.resolved && g.player1.toLowerCase() === currentAccount.toLowerCase())));
                localStorage.setItem('joinedGames', JSON.stringify(games.filter(g => !g.resolved && g.player2 && g.player2.toLowerCase() === currentAccount.toLowerCase())));
            }
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

export function updateResultsModal(games, account, resolveGame) {
    console.log('Updating results modal with:', games);
    const resultsModalList = document.getElementById('resultsModalList');
    resultsModalList.innerHTML = '';
    if (!account) {
        resultsModalList.innerHTML = '<li class="text-center text-xs opacity-70">Connect wallet to view games.</li>';
        document.getElementById('resultsNotification').textContent = '';
        document.getElementById('resultsNotification').style.display = 'none';
        return;
    }
    const accountLower = account.toLowerCase();
    const userGames = games.filter(game =>
        game.player1.toLowerCase() === accountLower || (game.player2 && game.player2.toLowerCase() === accountLower)
    );
    const unviewedCount = userGames.filter(game => game.resolved && !game.viewed).length;
    document.getElementById('resultsNotification').textContent = unviewedCount > 0 ? unviewedCount : '';
    document.getElementById('resultsNotification').style.display = unviewedCount > 0 ? 'flex' : 'none';
    if (userGames.length === 0) {
        resultsModalList.innerHTML = '<li class="text-center text-xs opacity-70">No game history available.</li>';
        return;
    }
    userGames.forEach(game => {
        const isResolved = game.resolved;
        const win = isResolved && game.winner === accountLower;
        const resultText = isResolved ? (win ? 'You Win!' : 'You Lose!') : 'Result Pending';
        const buttonText = isResolved ? (game.viewed ? 'Replay' : 'Resolve') : 'Pending';
        const disabled = isResolved ? '' : 'disabled';
        const li = document.createElement('li');
        li.className = 'game-card p-2 flex items-center space-x-2';
        li.innerHTML = `
            <img src="${game.image1}" alt="NFT #${game.tokenId1}" class="w-8 h-8 rounded" onerror="this.src='https://via.placeholder.com/32?text=NF';" />
            <img src="${game.image2 || 'https://via.placeholder.com/32?text=NF'}" alt="NFT #${game.tokenId2 || 'N/A'}" class="w-8 h-8 rounded" onerror="this.src='https://via.placeholder.com/32?text=NF';" />
            <div class="flex-1">
                <p class="text-xs">Game #${game.gameId}: <span class="${isResolved ? (win ? 'text-green-500' : 'text-red-500') : ''}">${resultText}</span></p>
                <p class="text-gray-400 text-xs">Date: ${game.localDate}</p>
            </div>
            <button class="neon-button text-xs py-0.5 px-1 resolve-game-btn" data-game-id="${game.gameId}" ${disabled}>${buttonText}</button>
        `;
        resultsModalList.appendChild(li);
    });
    if (!document.getElementById('refreshHistoryBtn')) {
        const refreshBtn = document.createElement('button');
        refreshBtn.id = 'refreshHistoryBtn';
        refreshBtn.className = 'neon-button text-sm py-1 px-2 mt-2 w-full';
        refreshBtn.textContent = 'Refresh History';
        refreshBtn.onclick = () => window.fetchResolvedGames();
        resultsModalList.after(refreshBtn);
    }
    document.querySelectorAll('.resolve-game-btn').forEach(button => {
        button.addEventListener('click', () => {
            if (!uiOptions.getAccount()) {
                console.warn('No account connected, skipping resolve/replay');
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
    video.innerHTML = `<source src="${src}" type="video/mp4">`;
    resultText.textContent = text;
    resultText.className = `text-base font-bold text-center ${text === 'You Win!' ? 'text-green-500' : 'text-red-500'} status-pulse`;
    overlay.classList.remove('hidden', 'fade-out');
    overlay.classList.add('fade-in');
    video.play().catch(error => {
        console.error('Error playing video:', error);
        updateStatus(`Error playing result video: ${error.message}`);
        overlay.classList.remove('fade-in');
        overlay.classList.add('fade-out');
        setTimeout(() => {
            overlay.classList.add('hidden');
            overlay.classList.remove('fade-out');
            animationNFTs.innerHTML = '';
            isPlayingResultVideo = false;
            updateResultsModal(uiOptions.getResolvedGames(), uiOptions.getAccount(), uiOptions.resolveGame);
        }, 800);
    });
    video.onended = () => {
        console.log('Video ended, hiding overlay');
        overlay.classList.remove('fade-in');
        overlay.classList.add('fade-out');
        setTimeout(() => {
            overlay.classList.add('hidden');
            overlay.classList.remove('fade-out');
            animationNFTs.innerHTML = '';
            isPlayingResultVideo = false;
            updateResultsModal(uiOptions.getResolvedGames(), uiOptions.getAccount(), uiOptions.resolveGame);
        }, 800);
    };
}