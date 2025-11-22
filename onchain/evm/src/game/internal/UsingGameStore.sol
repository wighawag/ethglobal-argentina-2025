// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../interfaces/UsingGameTypes.sol";
import "./UsingVirtualTime.sol";

abstract contract UsingGameStore is UsingGameTypes, UsingVirtualTime {
    /// @notice the timestamp (in seconds) at which the game start, it start in the commit phase
    uint256 internal immutable START_TIME;
    /// @notice the duration of the commit phase in seconds
    uint256 internal immutable COMMIT_PHASE_DURATION;
    /// @notice the duration of the reveal phase in seconds
    uint256 internal immutable REVEAL_PHASE_DURATION;
    /// @notice the avatars NFT collection
    IERC721 internal immutable AVATARS;
    /// @notice the number of spaceships you get on activation
    bytes32 internal immutable GENESIS_HASH;
    /// @notice the number of spaceships you get on activation
    uint256 internal immutable NUM_SPACESHIPS_ON_ACTIVATION;
    /// @notice the production cap in term of duration, so if a star system produce 2/hours then a production cap of 1 hour, means 2
    uint256 internal immutable PRODUCTION_CAP_AS_DURATION;

    // TODO use
    /// @notice the number of action a hash represent, after that players make use of further reveal transactions
    uint8 internal constant MAX_NUM_ACTIONS_PER_HASH = 32;

    mapping(uint256 => Avatar) internal _avatars;
    mapping(uint256 => Empire) internal _empires;

    // allow to get all empires per owner in the game
    mapping(address owner => uint256[]) internal _ownedEmpires;
    mapping(uint256 avatarID => uint256) internal _ownedEmpiresIndex;

    mapping(uint64 location => StarSystemState) internal _starSystems;

    mapping(uint256 => Commitment) internal _commitments;

    /// @notice Create an instance of a game
    /// @param config configuration options for the game
    constructor(Config memory config) UsingVirtualTime(config.time) {
        START_TIME = config.startTime;
        COMMIT_PHASE_DURATION = config.commitPhaseDuration;
        REVEAL_PHASE_DURATION = config.revealPhaseDuration;
        AVATARS = config.avatars;
        GENESIS_HASH = config.genesisHash;
        NUM_SPACESHIPS_ON_ACTIVATION = config.numSpaceshipsOnActivation;
        PRODUCTION_CAP_AS_DURATION = config.productionCapAsDuration;
    }
}
