const socket = io('https://sketchyflipback.onrender.com'); // Update with your backend URL
let provider;
let signer;
let account;
let daycareContract;
let nftContract;
const daycareAddress = '0xd32247484111569930a0b9c7e669e8E108392496';
const nftAddress = '0x08533a2b16e3db03eebd5b23210122f97dfcb97d';

async function loadABIs() {
    try {
        const daycareResponse = await fetch('/abi/daycareABI.json');
        const nftResponse = await fetch('/abi/nftABI.json');
        if (!daycareResponse.ok || !nftResponse.ok) {
            throw new Error('Failed to load ABI files');
        }
        const daycareABI = await daycareResponse.json();
        const nftABI = await nftResponse.json();
        return { daycareABI, nftABI };
    } catch (error) {
        console.error('Error loading ABIs:', error);
        throw error;
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const connectWalletBtn = document.getElementById('connectWallet');
    const accountStatus = document.getElementById('accountStatus');
    const stakeButton = document.getElementById('stakeButton');
    const backButton = document.getElementById('backButton');
    const closeStake = document.getElementById('closeStake');
    const confirmSelection = document.getElementById('confirmSelection');
    const stakeSelected = document.getElementById('stakeSelected');
    const burnPoints = document.getElementById('burnPoints');
    const refreshLeaderboard = document.getElementById('refreshLeaderboard');

    async function init() {
        try {
            const { daycareABI, nftABI } = await loadABIs();
            if (window.ethereum) {
                provider = new ethers.providers.Web3Provider(window.ethereum);
                daycareContract = new ethers.Contract(daycareAddress, daycareABI, provider);
                nftContract = new ethers.Contract(nftAddress, nftABI, provider);
            } else {
                console.error('Please install MetaMask!');
                accountStatus.textContent = 'Please install MetaMask!';
            }
        } catch (error) {
            console.error('Initialization failed:', error);
            accountStatus.textContent = 'Initialization failed';
        }
    }

    connectWalletBtn.addEventListener('click', async () => {
        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            signer = provider.getSigner();
            account = await signer.getAddress();
            accountStatus.textContent = `Account: ${account.slice(0, 6)}...${account.slice(-4)}`;
            document.getElementById('mainMenu').classList.add('hidden');
            document.getElementById('gameInterface').classList.remove('hidden');
            socket.emit('registerAddress', { address: account });
            socket.emit('fetchUserDaycare', { account });
        } catch (error) {
            console.error('Wallet connection failed:', error);
            accountStatus.textContent = 'Wallet connection failed';
        }
    });

    stakeButton.addEventListener('click', async () => {
        document.getElementById('mainMenu').classList.add('hidden');
        document.getElementById('gameInterface').classList.add('hidden');
        document.getElementById('stakeContainer').classList.remove('hidden');
        await loadNFTs();
    });

    backButton.addEventListener('click', () => {
        document.getElementById('stakeContainer').classList.add('hidden');
        document.getElementById('mainMenu').classList.remove('hidden');
    });

    closeStake.addEventListener('click', () => {
        document.getElementById('stakeContainer').classList.add('hidden');
        document.getElementById('mainMenu').classList.remove('hidden');
    });

    let selectedNFTs = [];

    async function loadNFTs() {
        const nftList = document.getElementById('nftList');
        nftList.innerHTML = '';
        try {
            const balance = await nftContract.balanceOf(account);
            for (let i = 0; i < balance; i++) {
                const tokenId = await nftContract.tokenOfOwnerByIndex(account, i);
                let image = 'https://via.placeholder.com/64';
                try {
                    let uri = await nftContract.tokenURI(tokenId);
                    if (uri.startsWith('ipfs://')) uri = `https://ipfs.io/ipfs/${uri.slice(7)}`;
                    const response = await fetch(uri);
                    if (response.ok) {
                        const metadata = await response.json();
                        image = metadata.image.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${metadata.image.slice(7)}` : metadata.image;
                    }
                } catch (error) {
                    console.error(`Error fetching metadata for token ${tokenId}:`, error);
                }
                const div = document.createElement('div');
                div.className = 'p-2 bg-gray-700 rounded cursor-pointer';
                div.innerHTML = `<img src="${image}" alt="NFT ${tokenId}" class="w-full h-32 object-cover rounded"><p>Token ID: ${tokenId}</p>`;
                div.addEventListener('click', () => {
                    if (selectedNFTs.includes(tokenId.toString())) {
                        selectedNFTs = selectedNFTs.filter(id => id !== tokenId.toString());
                        div.classList.remove('bg-green-600');
                    } else {
                        selectedNFTs.push(tokenId.toString());
                        div.classList.add('bg-green-600');
                    }
                    document.getElementById('selectedNFTs').textContent = `Selected NFTs: ${selectedNFTs.join(', ') || 'None'}`;
                });
                nftList.appendChild(div);
            }
        } catch (error) {
            console.error('Error loading NFTs:', error);
        }
    }

    confirmSelection.addEventListener('click', async () => {
        document.getElementById('stakeContainer').classList.add('hidden');
        document.getElementById('gameInterface').classList.remove('hidden');
        document.getElementById('selectedNFTs').textContent = `Selected NFTs: ${selectedNFTs.join(', ') || 'None'}`;
    });

    stakeSelected.addEventListener('click', async () => {
        if (!selectedNFTs.length) return alert('No NFTs selected');
        try {
            const signedContract = daycareContract.connect(signer);
            const tx = await signedContract.dropOffMultiple(selectedNFTs);
            await tx.wait();
            socket.emit('fetchUserDaycare', { account });
            selectedNFTs = [];
            document.getElementById('selectedNFTs').textContent = 'No NFTs selected';
        } catch (error) {
            console.error('Error staking NFTs:', error);
            alert('Failed to stake NFTs');
        }
    });

    burnPoints.addEventListener('click', async () => {
        const amount = prompt('Enter points to burn:');
        if (!amount || isNaN(amount)) return alert('Invalid amount');
        try {
            const signedContract = daycareContract.connect(signer);
            const tx = await signedContract.burnPoints(amount);
            await tx.wait();
            socket.emit('fetchUserDaycare', { account });
        } catch (error) {
            console.error('Error burning points:', error);
            alert('Failed to burn points');
        }
    });

    refreshLeaderboard.addEventListener('click', () => {
        socket.emit('refreshLeaderboard');
    });

    socket.on('userDaycareUpdate', (data) => {
        document.getElementById('totalPoints').textContent = data.points;
        const stakedNFTsList = document.getElementById('stakedNFTsList');
        stakedNFTsList.innerHTML = '';
        data.daycares.forEach((daycare, index) => {
            const div = document.createElement('div');
            div.className = 'p-4 bg-gray-700 rounded';
            div.innerHTML = `
                <img src="${daycare.image}" alt="NFT ${daycare.tokenId}" class="w-full h-32 object-cover rounded mb-2">
                <p>Token ID: ${daycare.tokenId}</p>
                <p>Start Time: ${new Date(Number(daycare.startTime) * 1000).toLocaleString()}</p>
                <p>Claimed Points: ${daycare.claimedPoints}</p>
                <p>Pending Points: ${daycare.pending}</p>
                <button class="claimBtn bg-blue-600 btn hover:bg-blue-700 text-white py-1 px-2 rounded mt-2" data-index="${index}">Claim Points</button>
                <button class="pickupBtn bg-red-600 btn hover:bg-red-700 text-white py-1 px-2 rounded mt-2" data-index="${index}">Pick Up</button>
            `;
            stakedNFTsList.appendChild(div);
        });

        document.querySelectorAll('.claimBtn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const index = btn.dataset.index;
                try {
                    const signedContract = daycareContract.connect(signer);
                    const tx = await signedContract.claimPoints(index);
                    await tx.wait();
                    socket.emit('fetchUserDaycare', { account });
                } catch (error) {
                    console.error('Error claiming points:', error);
                    alert('Failed to claim points');
                }
            });
        });

        document.querySelectorAll('.pickupBtn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const index = btn.dataset.index;
                try {
                    const signedContract = daycareContract.connect(signer);
                    const tx = await signedContract.pickUp(index);
                    await tx.wait();
                    socket.emit('fetchUserDaycare', { account });
                } catch (error) {
                    console.error('Error picking up NFT:', error);
                    alert('Failed to pick up NFT');
                }
            });
        });
    });

    socket.on('leaderboardUpdate', (leaderboard) => {
        const leaderboardTable = document.getElementById('leaderboardTable');
        leaderboardTable.innerHTML = '';
        leaderboard.forEach((entry, index) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="p-2">${index + 1}</td>
                <td class="p-2">${entry.address.slice(0, 6)}...${entry.address.slice(-4)}</td>
                <td class="p-2">${entry.points}</td>
            `;
            leaderboardTable.appendChild(row);
        });
    });

    await init();
});