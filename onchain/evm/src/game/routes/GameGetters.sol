// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../internal/UsingGameInternal.sol";
import "../interfaces/IGame.sol";

contract GameGetters is IGameGetters, UsingGameInternal {
    constructor(Config memory config) UsingGameInternal(config) {}

    function getEpoch() external view returns (uint64 epoch, bool commiting) {
        return _epoch();
    }

    function getCommitment(
        uint256 avatarID
    ) external view returns (Commitment memory commitment) {
        return _commitments[avatarID];
    }

    function getConfig() external view returns (Config memory config) {
        return
            Config({
                startTime: START_TIME,
                commitPhaseDuration: COMMIT_PHASE_DURATION,
                revealPhaseDuration: REVEAL_PHASE_DURATION,
                time: TIME,
                avatars: AVATARS
            });
    }

    function getStarSystems(
        uint64[] calldata locations
    )
        external
        view
        returns (PublicStarSystem[] memory starSystems, uint64 epoch)
    {
        (epoch, ) = _epoch();
        starSystems = _getPublicStarSystems(locations, epoch);
    }

    function getStarSystem(
        uint64 location
    ) external view returns (PublicStarSystem memory starSystem, uint64 epoch) {
        (epoch, ) = _epoch();
        starSystem = _getPublicStarSystem(location, epoch);
    }
}
