// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

import "./UsingGameStore.sol";
import "../interfaces/UsingGameEvents.sol";
import "../interfaces/UsingGameErrors.sol";
import "../../utils/PositionUtils.sol";
import "../../utils/StringUtils.sol";
import "hardhat/console.sol";
import "../../utils/Extraction.sol";

abstract contract UsingGameInternal is
    UsingGameStore,
    UsingGameEvents,
    UsingGameErrors
{
    using Extraction for bytes32;

    constructor(Config memory config) UsingGameStore(config) {}

    //-------------------------------------------------------------------------
    // ENTRY POINTS
    //-------------------------------------------------------------------------
    function _deposit(
        uint256 avatarID,
        uint256 empireSubID,
        address owner,
        address controller
    ) internal {
        uint256 empireID = (uint256(uint160(owner)) << 96) + empireSubID;
        if (_empires[empireID].avatarID != 0) {
            revert EmpireHasAlreadyAnAvatar(empireID);
        }
        _empires[empireID] = Empire({
            owner: owner,
            controller: controller,
            avatarID: avatarID
        });

        // TODO mint Empire and handle transfer here to to update controller and owner

        // could make the Game the NFT contract
        //   but then what about StarSystem ?
        //  one of them or both could have separate NFT contract whose getters calls in the Game contract
        //  and then for transfer, the Game call into them after each write to ensure events are emitted from them

        uint256 length = _ownedEmpires[owner].length;
        _ownedEmpires[owner].push(avatarID);
        _ownedEmpiresIndex[empireID] = length;
        // TODO event
    }

    function _makeCommitment(
        address controller,
        uint256 empireID,
        bytes24 commitmentHash
    ) internal {
        if (_empires[empireID].controller != controller) {
            revert UsingGameErrors.NotAuthorizedController(controller);
        }

        (uint64 epoch, bool commiting) = _epoch();

        if (!commiting) {
            revert InRevealPhase();
        }

        Commitment storage commitment = _commitments[empireID];

        if (commitment.epoch != 0 && commitment.epoch != epoch) {
            // TODO reenable
            // revert PreviousCommitmentNotRevealed();
            // TODO delete
            emit PreviousCommitmentNotRevealedEvent(
                empireID,
                commitment.epoch,
                commitmentHash
            );
        }

        commitment.hash = commitmentHash;
        commitment.epoch = epoch;

        emit CommitmentMade(empireID, epoch, commitmentHash);
    }

    function _cancelCommitment(address controller, uint256 empireID) internal {
        if (_empires[empireID].controller != controller) {
            revert UsingGameErrors.NotAuthorizedController(controller);
        }

        (uint64 epoch, bool commiting) = _epoch();
        if (!commiting) {
            revert InRevealPhase();
        }

        Commitment storage commitment = _commitments[empireID];
        if (commitment.epoch == 0) {
            revert NoCommitmentToCancel();
        }

        if (commitment.epoch != epoch) {
            revert PreviousCommitmentNotRevealed();
        }

        // Note that we do not reset the hash
        // This ensure the slot do not get reset and keep the gas cost consistent across execution
        commitment.epoch = 0;

        emit CommitmentCancelled(empireID, epoch);
    }

    function _reveal(
        uint256 empireID,
        Action[] calldata actions,
        bytes32 secret
    ) internal {
        (uint64 epoch, bool commiting) = _epoch();

        if (commiting) {
            revert InCommitmentPhase();
        }
        Commitment storage commitment = _commitments[empireID];

        if (commitment.epoch == 0) {
            revert NothingToReveal();
        }

        if (commitment.epoch != epoch) {
            revert InvalidEpoch();
        }

        bytes24 hashRevealed = commitment.hash;
        _checkHash(hashRevealed, actions, secret);

        (uint64 newPosition, uint256 numActionsResolved) = _resolveActions(
            empireID,
            epoch,
            actions
        );

        emit CommitmentRevealed(
            empireID,
            epoch,
            hashRevealed,
            actions[0:numActionsResolved]
        );

        commitment.epoch = 0; // used
    }

    function _acknowledgeMissedReveal(uint256 empireID) internal {
        // TODO burn / stake ....
        Commitment storage commitment = _commitments[empireID];

        if (commitment.epoch == 0) {
            revert NothingToReveal();
        }

        (uint64 epoch, ) = _epoch();

        if (commitment.epoch == epoch) {
            revert CanStillReveal();
        }

        commitment.epoch = 0;

        // TODO block nft control

        // here we cannot know whether there were further move or even any moves
        // we just burn all tokens in reserve
        emit CommitmentVoid(empireID, epoch);
    }

    function _getPublicStarSystem(
        uint64 location,
        uint64 epoch
    ) internal view returns (PublicStarSystem memory starSystem) {
        StarSystemState memory starSystemState = _starSystems[location];
        starSystem = PublicStarSystem({
            empireID: starSystemState.empireID,
            numSpaceships: starSystemState.numSpaceships,
            isActive: starSystemState.isActive,
            lastUpdatedEpoch: starSystemState.lastUpdatedEpoch,
            owner: _empires[starSystemState.empireID].owner
        });
    }

    function _getPublicStarSystems(
        uint64[] calldata locations,
        uint64 epoch
    ) internal view returns (PublicStarSystem[] memory starSystems) {
        uint256 numLocations = locations.length;
        starSystems = new PublicStarSystem[](numLocations);
        for (uint256 i = 0; i < numLocations; i++) {
            StarSystemState memory starSystemState = _starSystems[locations[i]];
            starSystems[i] = PublicStarSystem({
                empireID: starSystemState.empireID,
                numSpaceships: starSystemState.numSpaceships,
                isActive: starSystemState.isActive,
                lastUpdatedEpoch: starSystemState.lastUpdatedEpoch,
                owner: _empires[starSystemState.empireID].owner
            });
        }
    }

    //-------------------------------------------------------------------------

    struct ActionResolution {
        uint256 empireID;
        uint64 epoch;
        bool stopProcessing;
        uint256 numActionsResolved;
    }

    //-------------------------------------------------------------------------
    // INTERNALS
    //-------------------------------------------------------------------------
    function _resolveActions(
        uint256 empireID,
        uint64 epoch,
        Action[] memory actions
    ) internal returns (uint64 newPosition, uint256 numActionsResolved) {
        ActionResolution memory resolution = ActionResolution({
            empireID: empireID,
            epoch: epoch,
            stopProcessing: false,
            numActionsResolved: 0
        });

        _forEachActions(resolution, actions);

        numActionsResolved = resolution.numActionsResolved;
    }

    function _forEachActions(
        ActionResolution memory resolution,
        Action[] memory actions
    ) internal {
        uint256 move_count = 0;
        for (uint256 i = 0; i < actions.length; i++) {
            Action memory action = actions[i];

            // NWSE (North, West, South, East)
            if (action.actionType == ActionType.AcquireStarSystem) {
                _acquireStarSystem(resolution, action.data);
            } else if (action.actionType == ActionType.SendFleet) {
                _sendFleet(resolution, action.data);
            } else if (action.actionType == ActionType.ResolveFleet) {
                _resolveFleet(resolution, action.data);
            }

            if (resolution.stopProcessing) {
                break;
            }
        }
    }

    function _acquireStarSystem(
        ActionResolution memory resolution,
        uint128 actionData
    ) internal  {
        uint64 location = uint64(actionData);
        StarSystemState storage starSystem = _starSystems[location];
        if (starSystem.empireID != 0) {
            // TODO auction or distance
            // for now skip

        } else {
            starSystem.empireID = resolution.empireID;
            starSystem.isActive = true;
            starSystem.lastUpdatedEpoch = resolution.epoch;
            // TODO NUM_SPACESHIPS_ON_ACTIVATION should be uint64 ?
            starSystem.numSpaceships = uint64(NUM_SPACESHIPS_ON_ACTIVATION);
        }
        
        resolution.numActionsResolved++;
        resolution.stopProcessing = false;
    }

    function _sendFleet(
        ActionResolution memory resolution,
        uint128 actionData
    ) internal  {
        uint64 from = uint64(actionData);
        uint64 spaceshipsSent = uint32(actionData >> 64);
        uint64 minArrivalEpoch = uint64(actionData >> 96); // TODO 128 bit do not fit all here

        // TODO use minArrivalEpoch
        
        StarSystemState storage fromStarSystem = _starSystems[from];
        if (fromStarSystem.empireID != resolution.empireID) {
            // TODO allow sending fleet even if attack happen and change empire
            // we track change of ownership but we need to track previous owner

        } else {
            // TODO do not allow sending fleet on the same epoch where you capture a star system
            if (fromStarSystem.numSpaceships < spaceshipsSent) {
                resolution.stopProcessing = false;
                return;
            } else {
                fromStarSystem.numSpaceships -= spaceshipsSent;
            }
            
        }

        // TODO
        uint64 distance = 0;
        if (distance == 0) {

        }

        resolution.numActionsResolved++;
        resolution.stopProcessing = false;
    }

    function _sendInstantFleet(
        ActionResolution memory resolution,
        uint128 actionData
    ) internal  {
        uint64 from = uint64(actionData);
        uint64 to = uint64(actionData >> 64);
        uint64 spaceshipsSent = uint32(actionData >> 128);
        
        StarSystemState storage fromStarSystem = _starSystems[from];
        if (fromStarSystem.empireID != resolution.empireID) {
            // TODO allow sending fleet even if attack happen and change empire
            // we track change of ownership but we need to track previous owner

        } else {
            // TODO do not allow sending fleet on the same epoch where you capture a star system
            if (fromStarSystem.numSpaceships < spaceshipsSent) {
                resolution.stopProcessing = false;
                return;
            } else {
                fromStarSystem.numSpaceships -= spaceshipsSent;
            }
            
        }

        StarSystemState storage toStarSystem = _starSystems[to];
        if (toStarSystem.numSpaceships >= spaceshipsSent) {
            // attack lost
            toStarSystem.numSpaceships -= spaceshipsSent;
        } else {
            // attack won;
            toStarSystem.numSpaceships = spaceshipsSent - toStarSystem.numSpaceships;
            toStarSystem.empireID = resolution.empireID;
        }
        
        
        resolution.numActionsResolved++;
        resolution.stopProcessing = false;
    }

    function _resolveFleet(
        ActionResolution memory resolution,
        // TODO consider using a different aproach for second reveal
        uint128 actionData
    ) internal pure {

        // 

        // StarSystemState storage fromStarSystem = _starSystems[from];
        // if (fromStarSystem.empireID != resolution.empireID) {
        //     // TODO allow sending fleet even if attack happen and change empire
        //     // we track change of ownership but we need to track previous owner

        // } else {
        //     // TODO do not allow sending fleet on the same epoch where you capture a star system
        //     if (fromStarSystem.numSpaceships < spaceshipsSent) {
        //         resolution.stopProcessing = false;
        //         return;
        //     } else {
        //         fromStarSystem.numSpaceships -= spaceshipsSent;
        //     }
            
        // }

        resolution.numActionsResolved++;
        resolution.stopProcessing = false;
    }

    function _epoch()
        internal
        view
        virtual
        returns (uint64 epoch, bool commiting)
    {
        uint256 epochDuration = COMMIT_PHASE_DURATION + REVEAL_PHASE_DURATION;
        uint256 time = _timestamp();
        if (time < START_TIME) {
            revert GameNotStarted();
        }
        uint256 timePassed = time - START_TIME;
        epoch = uint64(timePassed / epochDuration + 2); // epoch start at 2, this make the hypothetical previous reveal phase's epoch to be 1
        commiting =
            timePassed - ((epoch - 2) * epochDuration) < COMMIT_PHASE_DURATION;
    }

    function _checkHash(
        bytes24 commitmentHash,
        Action[] memory actions,
        bytes32 secret
    ) internal pure {
        // TODO remove
        if (commitmentHash == bytes24(0)) {
            return;
        }
        bytes24 computedHash = bytes24(keccak256(abi.encode(secret, actions)));
        if (commitmentHash != computedHash) {
            revert CommitmentHashNotMatching();
        }
    }

    function _planetData(uint256 location) internal view returns (bytes32) {
        return keccak256(abi.encodePacked(GENESIS_HASH, location));
    }

    function _subLocation(
        bytes32 data
    ) internal pure returns (int8 subX, int8 subY) {
        subX = 1 - int8(data.value8Mod(0, 3));
        subY = 1 - int8(data.value8Mod(2, 3));
    }

    function _production(bytes32 data) internal pure returns (uint16) {
        require(_exists(data), "PLANET_NOT_EXISTS");
        // TODO TRY : 1800,2100,2400,2700,3000,3300,3600, 3600, 3600, 3600,4000,4400,4800,5400,6200,7200 ?

        // 1800,2100,2400,2700,3000,3300,3600, 3600, 3600, 3600,4200,5400,6600,7800,9000,12000
        // 0x0708083409600a8c0bb80ce40e100e100e100e101068151819c81e7823282ee0
        return
            data.normal16(
                12,
                0x0708083409600a8c0bb80ce40e100e100e100e101068151819c81e7823282ee0
            ); // per hour
    }

    function _capWhenActive(uint16 production) internal view returns (uint256) {
        return
            NUM_SPACESHIPS_ON_ACTIVATION +
            (uint256(production) * PRODUCTION_CAP_AS_DURATION) /
            1 hours;
    }

    function _attack(bytes32 data) internal pure returns (uint16) {
        require(_exists(data), "PLANET_NOT_EXISTS");
        return 4000 + data.normal8(20) * 400; // 4,000 - 7,000 - 10,000
    }

    function _defense(bytes32 data) internal pure returns (uint16) {
        require(_exists(data), "PLANET_NOT_EXISTS");
        return 4000 + data.normal8(28) * 400; // 4,000 - 7,000 - 10,000
    }

    function _speed(bytes32 data) internal pure returns (uint16) {
        require(_exists(data), "PLANET_NOT_EXISTS");
        return 5005 + data.normal8(36) * 333; // 5,005 - 7,502.5 - 10,000
    }

    function _natives(bytes32 data) internal pure returns (uint16) {
        require(_exists(data), "PLANET_NOT_EXISTS");
        return 15000 + data.normal8(44) * 3000; // 15,000 - 37,500 - 60,000
    }

    function _exists(bytes32 data) internal pure returns (bool) {
        return data.value8Mod(52, 16) == 1; // 16 => 36 so : 1 planet per 6 (=24 min unit) square
        // also:
        // 20000 average starting numSpaceships (or max?)
        // speed of min unit = 30 min ( 1 hour per square)
        // production : 20000 per 6 hours
        // exit : 3 days ? => 72 distance
    }

    //-------------------------------------------------------------------------
}
