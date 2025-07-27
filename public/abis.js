export const gameABI = [
    "function createGame(uint256 tokenId)",
    "function joinGame(uint256 gameId, uint256 tokenId)",
    "function getOpenGames() view returns (uint256[])",
    "function getGame(uint256 gameId) view returns (tuple(address player1, uint256 tokenId1, address player2, uint256 tokenId2, bool active, uint256 requestId, bytes data, uint256 joinTimestamp, uint256 createTimestamp))",
    "function cancelUnjoinedGame(uint256 gameId)",
    "event GameCreated(uint256 gameId, address player1, uint256 tokenId1)",
    "event GameJoined(uint256 gameId, address player2, uint256 tokenId2)",
    "event RandomnessRequested(uint256 gameId, uint256 requestId)",
    "event GameResolved(uint256 gameId, address winner, uint256 tokenId1, uint256 tokenId2)",
    "event GameCanceled(uint256 gameId)"
];

export const nftABI = [
    "function tokensOfOwner(address owner) view returns (uint256[])",
    "function approve(address to, uint256 tokenId)",
    "function tokenURI(uint256 tokenId) view returns (string)"
];