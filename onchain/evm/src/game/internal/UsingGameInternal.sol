// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

import "./UsingGameStore.sol";
import "../interfaces/UsingGameEvents.sol";
import "../interfaces/UsingGameErrors.sol";
import "../../utils/PositionUtils.sol";
import "../../utils/StringUtils.sol";
import "hardhat/console.sol";

abstract contract UsingGameInternal is
    UsingGameStore,
    UsingGameEvents,
    UsingGameErrors
{
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
            if (action.actionType == ActionType.AcquireSolarSystem) {
                _acquireSolarSystem(resolution, action.data);
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

    function _acquireSolarSystem(
        ActionResolution memory resolution,
        uint128 actionData
    ) internal pure {
        resolution.numActionsResolved++;
        resolution.stopProcessing = true;
    }

    function _sendFleet(
        ActionResolution memory resolution,
        uint128 actionData
    ) internal view {
        resolution.numActionsResolved++;
        resolution.stopProcessing = true;
    }

    function _resolveFleet(
        ActionResolution memory resolution,
        uint128 actionData
    ) internal pure {
        resolution.numActionsResolved++;
        resolution.stopProcessing = true;
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

    //-------------------------------------------------------------------------
}
