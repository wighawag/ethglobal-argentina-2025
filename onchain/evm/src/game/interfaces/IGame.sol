// SPDX-License-Identifier: AGPL-3.0
pragma solidity ^0.8.0;

import "./UsingGameTypes.sol";
import "./UsingGameEvents.sol";
import "./UsingGameErrors.sol";

interface IGameCommit is UsingGameTypes {
    function commit(
        uint256 empireID,
        bytes24 commitmentHash,
        address payable payee
    ) external payable;

    function cancelCommit(uint256 empireID) external;
}

interface IGameReveal is UsingGameTypes {
    function reveal(
        uint256 empireID,
        Action[] calldata actions,
        bytes32 secret,
        address payable payee
    ) external payable;

    function acknowledgeMissedReveal(uint256 empireID) external;
}

interface IGameGetters is UsingGameTypes {
    function getEpoch() external view returns (uint64 epoch, bool commiting);

    function getCommitment(
        uint256 empireID
    ) external view returns (Commitment memory commitment);

    function getConfig() external view returns (Config memory config);
}

interface IGame is
    UsingGameEvents,
    UsingGameErrors,
    IGameCommit,
    IGameReveal,
    IGameGetters
{}
