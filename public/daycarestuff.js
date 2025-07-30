document.getElementById('stakeButton').addEventListener('click', () => {
    document.getElementById('mainMenu').classList.add('hidden');
    document.getElementById('gameInterface').classList.add('hidden');
    document.getElementById('stakeContainer').classList.remove('hidden');
});

document.getElementById('backButton').addEventListener('click', () => {
    document.getElementById('stakeContainer').classList.add('hidden');
    document.getElementById('mainMenu').classList.remove('hidden');
});