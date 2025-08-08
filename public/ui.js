let uiOptions = null;
let isPlayingResultVideo = false;
let lastResolvedGames, lastAccount, lastResolveGame;

export function initializeUI({ socket, getAccount, getResolvedGames, getUserTokens, setSelectedTokenId, resolveGame }) {
    uiOptions = { socket, getAccount, getResolvedGames, getUserTokens, setSelectedTokenId, resolveGame };

    document.getElementById('infoButton').addEventListener('click', () => {
        console.log('Opening info modal');
        document.getElementById('infoModal').style.display = 'block';
    });

    document.getElementById('betButton').addEventListener('click', () => {
        console.log('Bet-A-Sketchy clicked, showing game interface');
        document.getElementById('mainMenu').classList.add('hidden');
        document.getElementById('gameControls').classList.remove('hidden');
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

    document.getElementById('refreshResultsBtn').addEventListener('click', () => {
        socket.emit('fetchResolvedGames', { account: getAccount() });
        updateStatus('Refreshing game history...');
    });

    document.getElementById('refreshHistoryBtn').addEventListener('click', () => {
        socket.emit('fetchResolvedGames', { account: getAccount() });
        updateStatus('Refreshing game history...');
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
            socket.emit('markGamesViewed', { account: currentAccount, gameIds: getResolvedGames().map(g => g.gameId) });
        }
        document.getElementById('resultsModal').style.display = 'none';
    };

    document.getElementById('closeVideoBtn').addEventListener('click', () => {
        console.log('Closing video overlay');
        const overlay = document.getElementById('videoOverlay');
        overlay.classList.remove('fade-in');
        overlay.classList.add('fade-out');
        setTimeout(() => {
            overlay.classList.add('hidden');
            overlay.classList.remove('fade-out');
            document.getElementById('animationNFTs').innerHTML = '';
            isPlayingResultVideo = false;
            if (lastResolvedGames && lastAccount && lastResolveGame) {
                updateResultsModal(lastResolvedGames, lastAccount, lastResolveGame);
            }
        }, 800);
    });

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
                socket.emit('markGamesViewed', { account: currentAccount, gameIds: getResolvedGames().map(g => g.gameId) });
            }
            document.getElementById('resultsModal').style.display = 'none';
        }
        if (event.target === document.getElementById('videoOverlay')) {
            console.log('Clicked outside video overlay');
            const overlay = document.getElementById('videoOverlay');
            overlay.classList.remove('fade-in');
            overlay.classList.add('fade-out');
            setTimeout(() => {
                overlay.classList.add('hidden');
                overlay.classList.remove('fade-out');
                document.getElementById('animationNFTs').innerHTML = '';
                isPlayingResultVideo = false;
                if (lastResolvedGames && lastAccount && lastResolveGame) {
                    updateResultsModal(lastResolvedGames, lastAccount, lastResolveGame);
                }
            }, 800);
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

export function displayNFTsInModal(tokens) {
    const nftList = document.getElementById('nftList');
    nftList.innerHTML = '';
    if (!tokens || tokens.length === 0) {
        nftList.innerHTML = '<p class="text-white text-sm">No Sketchys found in your wallet/Connect Wallet.</p>';
        return;
    }
    tokens.forEach(tokenId => {
        const div = document.createElement('div');
        div.className = `nft-item ${tokenId === uiOptions.getSelectedTokenId?.() ? 'border-blue-500' : ''}`;
        div.innerHTML = `
            <img src="https://f005.backblazeb2.com/file/sketchymilios/${tokenId}.png" alt="Mymilio #${tokenId}" class="w-full max-w-[100px] object-contain rounded" loading="lazy">
            <p class="mt-1 text-white text-sm">Mymilio #${tokenId}</p>
        `;
        div.querySelector('img').onerror = () => {
            div.querySelector('img').src = 'https://via.placeholder.com/32x32?text=NF';
            div.innerHTML += '<p class="text-red-500 text-xs status-pulse">Image failed to load</p>';
        };
        div.onclick = () => {
            uiOptions.setSelectedTokenId(tokenId);
        };
        nftList.appendChild(div);
    });
}

export function selectNFT(tokenId) {
    const nftText = document.getElementById('nftText');
    const nftImage = document.getElementById('nftImage');
    if (tokenId) {
        nftText.textContent = `Mymilio #${tokenId}`;
        nftImage.src = `https://f005.backblazeb2.com/file/sketchymilios/${tokenId}.png`;
        nftImage.classList.remove('hidden');
        nftImage.onerror = () => {
            nftImage.src = 'https://via.placeholder.com/32x32?text=NF';
        };
    } else {
        nftText.textContent = 'Your Sketchy';
        nftImage.classList.add('hidden');
    }
}

export function updateOpenGames(games, account, joinGame) {
    const openGamesList = document.getElementById('openGamesList');
    openGamesList.innerHTML = '';
    if (!games || games.length === 0) {
        openGamesList.innerHTML = '<p class="yellow-info">No open games available. Create one to start!</p>';
        return;
    }
    games.forEach(game => {
        const isCreator = game.player1?.toLowerCase() === account?.toLowerCase();
        const isJoined = game.player2?.toLowerCase() === account?.toLowerCase();
        const isResolved = uiOptions.getResolvedGames().some(g => g.gameId === game.gameId);
        const div = document.createElement('div');
        div.className = 'yellow-info flex flex-row items-center justify-between px-3 py-2 my-1';
        div.style = 'min-width: 320px; width: 100%; max-width: 450px';
        div.innerHTML = `
            <div class="flex items-center space-x-2">
                <img src="https://f005.backblazeb2.com/file/sketchymilios/${game.tokenId1}.png" alt="Mymilio #${game.tokenId1}" class="w-12 h-12 object-contain rounded" loading="lazy">
                <div>
                    <p class="text-black text-xs font-bold mb-1">Game #${game.gameId}</p>
                    <p class="text-black text-xs font-bold mb-1">Player 1: ${game.player1 ? `${game.player1.slice(0, 6)}...${game.player1.slice(-4)}` : 'Loading...'}</p>
                    ${isCreator && !isJoined && !isResolved ? '<p class="text-yellow-500 text-xs status-pulse">You created this game</p>' : ''}
                    ${isResolved ? '<p class="text-green-500 text-xs status-pulse">Game Completed</p>' : ''}
                </div>
            </div>
            ${isResolved ? '<button class="neon-button text-sm py-1 px-2 view-game-btn" data-game-id="${game.gameId}">View</button>' : 
                `<button class="neon-button text-sm py-1 px-2 join-game-btn" data-game-id="${game.gameId}" ${!uiOptions.getSelectedTokenId?.() || isCreator || isJoined ? 'disabled' : ''} 
                    title="${isCreator ? 'You cannot join your own game' : !uiOptions.getSelectedTokenId?.() ? 'Select an NFT first' : isJoined ? 'You have already joined this game' : ''}">
                    ${isJoining && uiOptions.getSelectedGameId?.() === game.gameId ? 'Joining...' : 'Join'}
                </button>`}
        `;
        div.querySelector('img').onerror = () => {
            div.querySelector('img').src = 'https://via.placeholder.com/32x32?text=NF';
        };
        if (!isResolved) {
            const joinButton = div.querySelector('.join-game-btn');
            if (joinButton) {
                joinButton.onclick = () => {
                    joinGame(game.gameId);
                };
            }
        } else {
            const viewButton = div.querySelector('.view-game-btn');
            if (viewButton) {
                viewButton.onclick = () => {
                    document.getElementById('resultsButton').click();
                };
            }
        }
        openGamesList.appendChild(div);
    });
}

export function updateResultsModal(games, account, resolveGame) {
    lastResolvedGames = games;
    lastAccount = account;
    lastResolveGame = resolveGame;
    const resultsModalList = document.getElementById('resultsModalList');
    resultsModalList.innerHTML = '';
    const resultsNotification = document.getElementById('resultsNotification');
    const unresolvedCount = games.filter(g => !g.resolved || !g.userResolved[account?.toLowerCase() || '']).length;
    resultsNotification.textContent = unresolvedCount;
    resultsNotification.className = unresolvedCount > 0 ? '' : 'hidden';
    if (games.length === 0) {
        resultsModalList.innerHTML = '<p class="text-white text-sm">No game history available.</p>';
        return;
    }
    games.forEach(game => {
        const li = document.createElement('div');
        li.className = 'game-card flex items-center space-x-2 p-2';
        const resolveButton = !game.resolved || !game.userResolved[account?.toLowerCase() || ''] ? 
            `<button class="neon-button text-xs py-1 px-2 mt-1 resolve-game-btn" data-game-id="${game.gameId}">Resolve</button>` : '';
        li.innerHTML = `
            <img src="https://f005.backblazeb2.com/file/sketchymilios/${game.tokenId1}.png" alt="Mymilio #${game.tokenId1}" class="w-8 h-8 object-contain rounded">
            <img src="https://f005.backblazeb2.com/file/sketchymilios/${game.tokenId2}.png" alt="Mymilio #${game.tokenId2}" class="w-8 h-8 object-contain rounded">
            <div class="flex-1">
                <p class="text-white text-sm">
                    Game #${game.gameId}: ${game.resolved ? 
                        `<span class="${game.winner === account?.toLowerCase() ? 'text-green-500' : 'text-red-500'}">
                            You ${game.winner === account?.toLowerCase() ? 'Win' : 'Lose'}!
                        </span>` : 
                        'Result Pending'}
                </p>
                <p class="text-gray-400 text-xs">Date: ${new Date(Number(game.joinTimestamp || game.createTimestamp) * 1000).toLocaleString()}</p>
                ${resolveButton}
            </div>
        `;
        li.querySelectorAll('img').forEach(img => {
            img.onerror = () => {
                img.src = 'https://via.placeholder.com/32x32?text=NF';
            };
        });
        resultsModalList.appendChild(li);
    });
    document.querySelectorAll('.resolve-game-btn').forEach(button => {
        button.addEventListener('click', () => {
            if (!uiOptions.getAccount()) {
                console.warn('No account connected, skipping resolve/replay');
                updateStatus('Connect wallet to resolve games.');
                return;
            }
            const gameId = button.getAttribute('data-game-id');
            const game = uiOptions.getResolvedGames().find(g => g.gameId === gameId);
            if (!game) return;
            if (!game.resolved) {
                resolveGame(gameId);
            } else {
                const isReplay = game.userResolved[uiOptions.getAccount().toLowerCase()];
                const win = game.winner === uiOptions.getAccount().toLowerCase();
                playResultVideo(
                    win ? '/win.mp4' : '/lose.mp4',
                    win ? 'You Win!' : 'You Lose!',
                    game.image1 || `https://f005.backblazeb2.com/file/sketchymilios/${game.tokenId1}.png`,
                    game.image2 || `https://f005.backblazeb2.com/file/sketchymilios/${game.tokenId2}.png`
                );
                if (!isReplay) {
                    socket.emit('markGameResolved', { gameId, account: uiOptions.getAccount() });
                }
            }
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
    const videoError = document.getElementById('videoError');
    const validImage1 = image1 && image1 !== 'undefined' ? image1 : 'https://via.placeholder.com/64';
    const validImage2 = image2 && image2 !== 'undefined' ? image2 : 'https://via.placeholder.com/64';
    animationNFTs.innerHTML = `
        <img src="${validImage1}" alt="NFT1" class="w-12 h-12 rounded" onerror="this.src='https://via.placeholder.com/64';">
        <img src="${validImage2}" alt="NFT2" class="w-12 h-12 rounded" onerror="this.src='https://via.placeholder.com/64';">
    `;
    video.src = src;
    resultText.textContent = text;
    videoError.className = 'text-red-500 text-xs mt-1 text-center status-pulse hidden';
    overlay.classList.remove('hidden', 'fade-out');
    setTimeout(() => {
        overlay.classList.add('fade-in');
    }, 10);
    video.play().catch(error => {
        console.error('Error playing video:', error);
        updateStatus(`Error playing result video: ${error.message}`);
        videoError.textContent = `Error playing result video: ${error.message}`;
        videoError.className = 'text-red-500 text-xs mt-1 text-center status-pulse';
        overlay.classList.remove('fade-in');
        overlay.classList.add('fade-out');
        setTimeout(() => {
            overlay.classList.add('hidden');
            overlay.classList.remove('fade-out');
            animationNFTs.innerHTML = '';
            isPlayingResultVideo = false;
            if (lastResolvedGames && lastAccount && lastResolveGame) {
                updateResultsModal(lastResolvedGames, lastAccount, lastResolveGame);
            }
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
            if (lastResolvedGames && lastAccount && lastResolveGame) {
                updateResultsModal(lastResolvedGames, lastAccount, lastResolveGame);
            }
        }, 800);
    };
}