// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../internal/UsingGameInternal.sol";
import "../interfaces/IGame.sol";
import "solidity-kit/solc_0_8/ERC721/interfaces/IERC721Receiver.sol";

contract GameDeposit is IGameDeposit, UsingGameInternal, IERC721Receiver {
    constructor(Config memory config) UsingGameInternal(config) {}

    // TODO deposit via permit
    function deposit(
        uint256 avatarID,
        uint256 empireSubID,
        address controller,
        address payable payee
    ) external payable {
        _deposit(avatarID, empireSubID, msg.sender, controller);

        // transfer Character to the game
        AVATARS.transferFrom(msg.sender, address(this), avatarID);

        // extra steps for which we do not intend to track via events
        if (payee != address(0) && msg.value != 0) {
            payee.transfer(msg.value);
        }
    }

    function onERC721Received(
        address, // operator
        address, // from
        uint256 tokenID,
        bytes calldata data
    ) external override returns (bytes4) {
        if (msg.sender != address(AVATARS)) {
            revert OnlyAvatarsAreAccepted();
        }
        if (data.length != 96) {
            revert UsingGameErrors.InvalidData();
        }
        (uint256 empireSubID, address owner, address controller) = abi.decode(
            data,
            (uint256, address, address)
        );
        _deposit(tokenID, empireSubID, owner, controller);
        return IERC721Receiver.onERC721Received.selector;
    }

    function empiresPerOwner(
        address owner,
        uint256 startIndex,
        uint256 limit
    ) external view returns (uint256[] memory avatarIDs, bool more) {
        (uint64 epoch, ) = _epoch();
        uint256 total = _ownedEmpires[owner].length;
        if (startIndex >= total) {
            return (new uint256[](0), false);
        }
        uint256 max = total - startIndex;
        uint256 actualLimit = limit > max ? max : limit;

        uint256[] memory list = new uint256[](actualLimit);

        for (uint256 i = 0; i < actualLimit; i++) {
            uint256 empireID = _ownedEmpires[owner][startIndex + i];
            list[i] = empireID;
        }

        return (list, actualLimit != limit);
    }
}
