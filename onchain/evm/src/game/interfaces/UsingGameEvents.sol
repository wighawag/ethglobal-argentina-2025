// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

import "./UsingGameTypes.sol";

interface UsingGameEvents is UsingGameTypes {
    /// @notice A star system has been activated
    /// @param empireID the id of the empire activating the star system
    /// @param zone on which the star system is located
    /// @param epoch at which the acquisition happe
    /// @param starSystemID star system being acquired
    /// @param stake amount of take that the star system require
    event StarSystemAcquired(
        uint256 indexed empireID,
        uint64 indexed zone,
        uint64 indexed epoch,
        uint256 starSystemID,
        uint256 stake // not needed, but useful for indexers // TODO? remove
    );

    event FleetSent(
        uint256 indexed empireID,
        uint64 indexed zone,
        uint64 indexed epoch,
        uint256 fromStarSystemID, // TODO? would like to index this but we reacheed the 3 indexed param limit
        uint256 fleetID,
        uint256 numSpaceships
    );

    event StarSystemUpdated(
        uint256 indexed empireID,
        uint64 indexed zone,
        uint64 indexed epoch,
        uint256 starSystemID,
        StarSystemState state
    );

    event FleetArrived(
        uint256 indexed empireID,
        uint64 indexed zone,
        uint64 indexed epoch,
        uint256 fleetID, // TODO? would like to index this but we reacheed the 3 indexed param limit
        uint256 toStarSystemID
    );

    /// @notice A player has commited to make some actions and reveal them on the reveal phase
    /// @param empireID empire whose commitment is made
    /// @param epoch epoch number on which this commit belongs to
    /// @param commitmentHash the hash of moves
    event CommitmentMade(
        uint256 indexed empireID,
        uint64 indexed epoch,
        bytes24 commitmentHash
    );

    /// @notice A player has cancelled its current commitment (before it reached the reveal phase)
    /// @param empireID empire whose commitment is cancelled
    /// @param epoch epoch number on which this commit belongs to
    event CommitmentCancelled(uint256 indexed empireID, uint64 indexed epoch);

    /// @notice A player has acknowledged its failure to reveal its previous commitment
    /// @param empireID the empire that made the commitment
    /// @param epoch epoch number on which this commit belongs to
    event CommitmentVoid(uint256 indexed empireID, uint64 indexed epoch);

    /// @notice Player has revealed its previous commitment
    /// @param empireID empire whose action is commited
    /// @param epoch epoch number on which this commit belongs to
    /// @param commitmentHash the hash of the moves
    /// @param actions the actions
    event CommitmentRevealed(
        uint256 indexed empireID,
        uint64 indexed epoch,
        bytes24 commitmentHash,
        Action[] actions
    );
    // TODO add furtherHash field to CommitmentRevealed for unbounded actions

    // DEBUG
    event PreviousCommitmentNotRevealedEvent(
        uint256 indexed empireID,
        uint64 epoch,
        bytes24 commitmentHash
    );
}
