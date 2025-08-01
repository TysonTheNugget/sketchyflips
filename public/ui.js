let uiOptions = null;

let isPlayingResultVideo = false;
let lastResolvedGames, lastAccount, lastResolveGame;

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
        socket.emit('markGamesViewed', { account: getAccount(), gameIds: getResolvedGames().map(g => g.gameId) });
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
            socket.emit('markGamesViewed', { account: getAccount(), gameIds: getResolvedGames().map(g => g.gameId) });
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

// Enhanced image loading with better error handling and fallbacks
function createImageElement(src, alt, className, fallbackSrc = 'https://via.placeholder.com/64?text=NFT') {
    const img = document.createElement('img');
    img.alt = alt;
    img.className = className;
    
    // Enhanced IPFS gateway handling with multiple fallbacks
    let imageSrc = src;
    if (src && src.startsWith('ipfs://')) {
        // Try multiple IPFS gateways for better reliability
        const hash = src.slice(7);
        const gateways = [
            `https://gateway.pinata.cloud/ipfs/${hash}`,
            `https://cloudflare-ipfs.com/ipfs/${hash}`,
            `https://ipfs.io/ipfs/${hash}`,
            `https://dweb.link/ipfs/${hash}`
        ];
        imageSrc = gateways[0]; // Start with the most reliable one
        
        // Set up progressive fallback
        img.onerror = function() {
            const currentIndex = gateways.indexOf(this.src);
            if (currentIndex < gateways.length - 1) {
                console.log(`IPFS gateway failed: ${this.src}, trying next...`);
                this.src = gateways[currentIndex + 1];
            } else {
                console.log('All IPFS gateways failed, using fallback');
                this.src = fallbackSrc;
            }
        };
    } else {
        // Regular error handling for non-IPFS images
        img.onerror = function() {
            console.log(`Image failed to load: ${this.src}, using fallback`);
            this.src = fallbackSrc;
        };
    }
    
    img.src = imageSrc || fallbackSrc;
    return img;
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
        console.log('Creating NFT item for token ID:', token.id, 'Image:', token.image);
        const div = document.createElement('div');
        div.className = 'nft-item';
        
        // Use enhanced image creation
        const img = createImageElement(
            token.image, 
            `NFT #${token.id}`, 
            'w-full h-auto rounded border border-orange-500'
        );
        img.style.pointerEvents = 'none';
        
        const p = document.createElement('p');
        p.className = 'text-xs text-center mt-1';
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
    
    // Use enhanced image creation for selected NFT display
    const selectedDiv = document.getElementById('selectedNFT');
    selectedDiv.innerHTML = '';
    
    const container = document.createElement('div');
    container.className = 'flex items-center justify-center';
    
    const img = createImageElement(
        image, 
        `NFT #${tokenId}`, 
        'w-8 h-8 mr-2 rounded border border-orange-500'
    );
    
    const p = document.createElement('p');
    p.className = 'text-xs';
    p.textContent = `NFT #${tokenId}`;
    
    container.appendChild(img);
    container.appendChild(p);
    selectedDiv.appendChild(container);
    
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
        console.log('Rendering game:', game.id, 'Player:', game.player1, 'Token:', game.tokenId1, 'Image:', game.image);
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
        
        // Create image element with enhanced error handling
        const img = createImageElement(
            game.image, 
            `NFT #${game.tokenId1}`, 
            'w-8 h-8 mr-2 rounded shadow border border-orange-500'
        );
        
        const gameContainer = document.createElement('div');
        gameContainer.className = 'flex items-center';
        gameContainer.appendChild(img);
        
        const gameInfo = document.createElement('div');
        gameInfo.innerHTML = `
            <span class="font-bold text-xs">Game #${game.id}</span><br>
            <span class="text-xs opacity-70">NFT #${game.tokenId1} | ${game.createdAt}</span>
        `;
        gameContainer.appendChild(gameInfo);
        
        const actionContainer = document.createElement('div');
        actionContainer.innerHTML = actionButton;
        
        li.appendChild(gameContainer);
        li.appendChild(actionContainer);
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
    lastResolvedGames = resolvedGames;
    lastAccount = account;
    lastResolveGame = resolveGame;
    
    console.log('Updating results modal with:', resolvedGames);
    const resultsModalList = document.getElementById('resultsModalList');
    resultsModalList.innerHTML = '';
    
    const userGames = resolvedGames.filter(game => 
        !game.userResolved[account.toLowerCase()] && 
        (game.player1.toLowerCase() === account.toLowerCase() || 
         (game.player2 && game.player2.toLowerCase() === account.toLowerCase()))
    );
    
    const unviewedCount = userGames.filter(game => !game.viewed[account.toLowerCase()]).length;
    
    if (userGames.length === 0) {
        resultsModalList.innerHTML = '<li class="text-center text-xs opacity-70">No unresolved games.</li>';
        if (!isPlayingResultVideo) {
            document.getElementById('resultsButton').classList.add('hidden');
            document.getElementById('resultsNotification').classList.add('hidden');
        }
        return;
    }
    
    document.getElementById('resultsButton').classList.remove('hidden');
    document.getElementById('resultsNotification').classList.remove('hidden');
    document.getElementById('resultsNotification').textContent = unviewedCount || '0';
    
    userGames.forEach(game => {
        const isMine = account && (game.player1.toLowerCase() === account.toLowerCase() || 
                                  (game.player2 && game.player2.toLowerCase() === account.toLowerCase()));
        const resolveButton = isMine ? `<button class="neon-button py-0.5 px-1 text-xs resolve-game-btn" data-game-id="${game.gameId}">Resolve</button>` : '';
        
        const li = document.createElement('li');
        li.className = 'game-card p-2 flex justify-between items-center';
        
        const gameInfo = document.createElement('div');
        gameInfo.innerHTML = `
            <div class="font-bold text-xs">Game #${game.gameId}</div>
            <div class="text-xs">NFT #${game.tokenId1} vs ${game.tokenId2 || 'N/A'}</div>
        `;
        
        const actionContainer = document.createElement('div');
        actionContainer.innerHTML = resolveButton;
        
        li.appendChild(gameInfo);
        li.appendChild(actionContainer);
        resultsModalList.appendChild(li);
    });

    // Add event listeners for resolve buttons
    document.querySelectorAll('.resolve-game-btn').forEach(button => {
        button.addEventListener('click', () => {
            const gameId = button.getAttribute('data-game-id');
            resolveGame(gameId);
        });
    });
}

export function playResultVideo(src, text, image1, image2) {
    console.log('Playing result video:', src, text, 'Images:', image1, image2);
    
    // Prevent multiple videos from playing simultaneously
    if (isPlayingResultVideo) {
        console.log('Video already playing, ignoring new request');
        return;
    }
    
    isPlayingResultVideo = true;
    
    const video = document.getElementById('resultVideo');
    const overlay = document.getElementById('videoOverlay');
    const resultText = document.getElementById('resultText');
    const animationNFTs = document.getElementById('animationNFTs');

    // Enhanced image handling with better fallbacks
    const validImage1 = image1 && image1 !== 'undefined' && image1 !== 'null' ? image1 : 'https://via.placeholder.com/64?text=NFT1';
    const validImage2 = image2 && image2 !== 'undefined' && image2 !== 'null' ? image2 : 'https://via.placeholder.com/64?text=NFT2';

    // Clear previous content
    animationNFTs.innerHTML = '';
    
    // Create enhanced image elements for the animation
    const img1 = createImageElement(validImage1, 'NFT1', 'nft-animation-img');
    const img2 = createImageElement(validImage2, 'NFT2', 'nft-animation-img');
    
    animationNFTs.appendChild(img1);
    animationNFTs.appendChild(img2);

    // Use relative paths or data URLs for local videos, or provide web-accessible URLs
    let videoSrc = src;
    if (src.startsWith('/')) {
        // Convert to full URL or use a data URL/base64 encoded video
        videoSrc = window.location.origin + src;
    }
    
    video.src = videoSrc;
    resultText.textContent = text;

    // Show overlay with animation
    overlay.classList.remove('hidden', 'fade-out');
    
    // Add animation delay to ensure smooth transition
    requestAnimationFrame(() => {
        overlay.classList.add('fade-in');
    });

    // Enhanced video play with better error handling
    const playPromise = video.play();
    
    if (playPromise !== undefined) {
        playPromise.then(() => {
            console.log('Video started playing successfully');
        }).catch(error => {
            console.error('Error playing video:', error);
            // Fallback: show result without video
            showResultWithoutVideo(text, validImage1, validImage2);
        });
    }

    // Set up video end handler
    video.onended = () => {
        console.log('Video ended, hiding overlay');
        hideVideoOverlay();
    };

    // Set up error handler
    video.onerror = (error) => {
        console.error('Video error:', error);
        showResultWithoutVideo(text, validImage1, validImage2);
    };

    // Auto-hide after 10 seconds as fallback
    setTimeout(() => {
        if (isPlayingResultVideo) {
            console.log('Video timeout, force hiding overlay');
            hideVideoOverlay();
        }
    }, 10000);
}

// Helper function to show results without video
function showResultWithoutVideo(text, image1, image2) {
    console.log('Showing result without video:', text);
    
    const overlay = document.getElementById('videoOverlay');
    const video = document.getElementById('resultVideo');
    const resultText = document.getElementById('resultText');
    const animationNFTs = document.getElementById('animationNFTs');
    
    // Hide video, show just the result
    video.style.display = 'none';
    resultText.style.fontSize = '2rem';
    resultText.style.background = 'rgba(0,0,0,0.8)';
    resultText.style.padding = '20px';
    resultText.style.borderRadius = '10px';
    
    // Show for 3 seconds then hide
    setTimeout(() => {
        hideVideoOverlay();
    }, 3000);
}

// Helper function to hide video overlay
function hideVideoOverlay() {
    const overlay = document.getElementById('videoOverlay');
    const video = document.getElementById('resultVideo');
    const animationNFTs = document.getElementById('animationNFTs');
    
    overlay.classList.remove('fade-in');
    overlay.classList.add('fade-out');
    
    setTimeout(() => {
        overlay.classList.add('hidden');
        overlay.classList.remove('fade-out');
        animationNFTs.innerHTML = '';
        video.style.display = 'block'; // Reset video display
        video.src = ''; // Clear video source
        isPlayingResultVideo = false;
        
        // Update results modal after video ends
        if (lastResolvedGames && lastAccount && lastResolveGame) {
            updateResultsModal(lastResolvedGames, lastAccount, lastResolveGame);
        }
    }, 800);
}