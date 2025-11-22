// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

import "./UsingGameTypes.sol";

interface UsingGameEvents is UsingGameTypes {
    /// @notice A star system has been activated
    /// @param empireID the id of the empire activating the star system
    /// @param owner the account authorized to get the avatar back
    /// @param controller the account authorized to control the avatar in-game
    event StarSystemActivated(
        uint256 indexed empireID,
        address indexed owner,
        address controller
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
        uint64 indexed zone,
        bytes24 commitmentHash,
        Action[] actions
    );

    // DEBUG
    event PreviousCommitmentNotRevealedEvent(
        uint256 indexed empireID,
        uint64 epoch,
        bytes24 commitmentHash
    );
}
