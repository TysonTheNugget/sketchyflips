const socket = io('https://sketchyflipback.onrender.com'); // Update with your backend URL
let provider;
let signer;
let account;
let daycareContract;
let nftContract;
const daycareAddress = '0xd32247484111569930a0b9c7e669e8E108392496';
const nftAddress = '0x08533a2b16e3db03eebd5b23210122f97dfcb97d';

document.addEventListener('DOMContentLoaded', () => {
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
        if (window.ethereum) {
            provider = new ethers.providers.Web3Provider(window.ethereum);
            daycareContract = new ethers.Contract(daycareAddress, daycareABI, provider);
            nftContract = new ethers.Contract(nftAddress, nftABI, provider);
        } else {
            console.error('Please install MetaMask!');
            accountStatus.textContent = 'Please install MetaMask!';
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
        document.getElementById('gameInterface').classList.remove('hidden');
    });

    closeStake.addEventListener('click', () => {
        document.getElementById('stakeContainer').classList.add('hidden');
        document.getElementById('gameInterface').classList.remove('hidden');
    });

    let selectedNFTs = [];

    async function loadNFTs() {
        const nftList = document.getElementById('nftList');
        nftList.innerHTML = '';
        try {
            const balance = await nftContract.balanceOf(account);
            for (let i = 0; i < balance; i++) {
                const tokenId = await nftContract.tokenOfOwnerByIndex(account, i);
                const uri = await nftContract.tokenURI(tokenId);
                const image = uri.startsWith('ipfs://') ? `https://ipfs.io/ipfs/${uri.slice(7)}` : uri;
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
            await signedContract.dropOffMultiple(selectedNFTs);
            await signedContract.dropOffMultiple.estimateGas(selectedNFTs);
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
            await signedContract.burnPoints(amount);
            await signedContract.burnPoints.estimateGas(amount);
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
        data.daycares.forEach(daycare => {
            const div = document.createElement('div');
            div.className = 'p-4 bg-gray-700 rounded';
            div.innerHTML = `
                <img src="${daycare.image}" alt="NFT ${daycare.tokenId}" class="w-full h-32 object-cover rounded mb-2">
                <p>Token ID: ${daycare.tokenId}</p>
                <p>Start Time: ${new Date(Number(daycare.startTime) * 1000).toLocaleString()}</p>
                <p>Claimed Points: ${daycare.claimedPoints}</p>
                <p>Pending Points: ${daycare.pending}</p>
                <button class="claimBtn bg-blue-600 hover:bg-blue-700 text-white py-1 px-2 rounded mt-2" data-index="${daycare.index}">Claim Points</button>
                <button class="pickupBtn bg-red-600 hover:bg-red-700 text-white py-1 px-2 rounded mt-2" data-index="${daycare.index}">Pick Up</button>
            `;
            stakedNFTsList.appendChild(div);
        });

        document.querySelectorAll('.claimBtn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const index = btn.dataset.index;
                try {
                    const signedContract = daycareContract.connect(signer);
                    await signedContract.claimPoints(index);
                    await signedContract.claimPoints.estimateGas(index);
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
                    await signedContract.pickUp(index);
                    await signedContract.pickUp.estimateGas(index);
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

    init();
});

// Load ABIs from external files (assumed to be served by the backend or included in the project)
const daycareABI = [
    {"inputs":[{"internalType":"address","name":"_nftAddress","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},
    {"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"OwnableInvalidOwner","type":"error"},
    {"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"OwnableUnauthorizedAccount","type":"error"},
    {"inputs":[],"name":"ReentrancyGuardReentrantCall","type":"error"},
    {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"Claimed","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"tokenId","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"startTime","type":"uint256"}],"name":"DroppedOff","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"PickedUp","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"PointsAdded","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"},{"indexed":false,"internalType":"uint256","name":"amount","type":"uint256"}],"name":"PointsBurned","type":"event"},
    {"anonymous":false,"inputs":[],"name":"PointsEditingLocked","type":"event"},
    {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"user","type":"address"}],"name":"UserAdded","type":"event"},
    {"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"addPoints","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address[]","name":"users","type":"address[]"},{"internalType":"uint256[]","name":"amounts","type":"uint256[]"}],"name":"addPointsBatch","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"burnPoints","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256[]","name":"daycareIndices","type":"uint256[]"}],"name":"claimMultiple","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"daycareIndex","type":"uint256"}],"name":"claimPoints","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"daycares","outputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"claimedPoints","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"dropOff","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256[]","name":"tokenIds","type":"uint256[]"}],"name":"dropOffMultiple","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getDaycares","outputs":[{"components":[{"internalType":"uint256","name":"tokenId","type":"uint256"},{"internalType":"uint256","name":"startTime","type":"uint256"},{"internalType":"uint256","name":"claimedPoints","type":"uint256"}],"internalType":"struct MymilioDaycare.DaycareInfo[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"getLeaderboard","outputs":[{"internalType":"address[]","name":"","type":"address[]"},{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"user","type":"address"},{"internalType":"uint256","name":"daycareIndex","type":"uint256"}],"name":"getPendingPoints","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getTotalPoints","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"lockPointsEditing","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"nft","outputs":[{"internalType":"contract IERC721","name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"daycareIndex","type":"uint256"}],"name":"pickUp","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256[]","name":"daycareIndices","type":"uint256[]"}],"name":"pickUpMultiple","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"points","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"pointsEditingLocked","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"pointsPerDay","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[{"internalType":"uint256","name":"","type":"uint256"}],"name":"userAddresses","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"}
];

const nftABI = [
    {"inputs":[{"internalType":"uint256","name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"owner","type":"address"},{"internalType":"uint256","name":"index","type":"uint256"}],"name":"tokenOfOwnerByIndex","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
];