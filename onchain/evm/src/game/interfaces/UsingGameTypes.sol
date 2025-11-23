// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "solidity-kit/solc_0_8/debug/time/interfaces/ITime.sol";
import "solidity-kit/solc_0_8/ERC721/interfaces/IERC721.sol";

interface UsingGameTypes {
    // ------------------------------------------------------------------------
    // EXTERNAL TYPES
    // ------------------------------------------------------------------------

    /// @notice The set of possible action
    enum ActionType {
        AcquireStarSystem,
        SendFleet,
        ResolveFleet
    }

    /// @notice the action and its associated data
    struct Action {
        ActionType actionType;
        uint128 data;
    }

    /// @notice Config struct to configure the game instance
    struct Config {
        uint256 startTime;
        uint256 commitPhaseDuration;
        uint256 revealPhaseDuration;
        ITime time;
        IERC721 avatars;
        bytes32 genesisHash;
        uint256 numSpaceshipsOnActivation;
        uint256 productionCapAsDuration;
    }

    struct PublicStarSystem {
        uint256 empireID;
        uint64 numSpaceships;
        bool isActive;
        uint64 lastUpdatedEpoch;
        address owner;
    }

    // ------------------------------------------------------------------------

    // ------------------------------------------------------------------------
    // STORAGE TYPES
    // ------------------------------------------------------------------------

    // empireID -> Empire
    struct Empire {
        address owner;
        address controller;
        uint256 avatarID;
    }

    // avatarID -> Avatar
    struct Avatar {
        uint256 empire;
    }

    struct StarSystemState {
        uint256 empireID;
        uint64 numSpaceships;
        bool isActive;
        uint64 lastUpdatedEpoch;
    }

    struct Commitment {
        bytes24 hash;
        uint64 epoch;
    }
    // ------------------------------------------------------------------------
}
