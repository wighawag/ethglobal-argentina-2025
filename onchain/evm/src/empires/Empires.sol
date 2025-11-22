// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.0;

import "solidity-kit/solc_0_8/ERC721/implementations/BasicERC721.sol";
import "solidity-kit/solc_0_8/ERC721/interfaces/IERC721Metadata.sol";

contract Empires is BasicERC721, IERC721Metadata {
    // ------------------------------------------------------------------------
    // ERRORS
    // ------------------------------------------------------------------------
    error NotAuthorizedSigner(address signer);

    // ------------------------------------------------------------------------
    string public constant symbol = "EMPIRE";

    // CONSTANTS
    // ------------------------------------------------------------------------

    // ERC-721
    // ------------------------------------------------------------------------

    /// @inheritdoc IERC721Metadata
    function name() public pure returns (string memory) {
        return "Conquest.eth's Empires";
    }

    /// @inheritdoc IERC721Metadata
    function tokenURI(uint256) external pure returns (string memory) {
        // TODO
        return
            'data:application/json,{"name":"Conquest.eth%20Empires","description":"Unique%20Empires.","image":""}';
    }

    // ------------------------------------------------------------------------
    // SETTERS
    // ------------------------------------------------------------------------

    function createEmpire(address to, uint256 id) external {
        // TODO
        // require avatar to be locked in
        require(to != address(0), "Invalid address");
        require(id > 0, "Invalid ID");
        _mint(to, id, bytes(""));
    }

    function execute(
        uint256 empireID,
        address to,
        uint256 value,
        bytes calldata data
    ) external payable returns (bytes memory result) {
        if (!_isValidSigner(empireID, msg.sender)) {
            revert NotAuthorizedSigner(msg.sender);
        }
        bool success;
        (success, result) = to.call{value: value}(data);

        if (!success) {
            assembly {
                revert(add(result, 32), mload(result))
            }
        }
    }

    // ------------------------------------------------------------------------
    // INTERNAL
    // ------------------------------------------------------------------------

    function _mint(address to, uint256 id, bytes memory data) internal {
        _safeMint(to, id, false, data);
    }

    function _isValidSigner(
        uint256 id,
        address signer
    ) internal view returns (bool) {
        if (signer == _ownerOf(id)) {
            return true;
        }
        return false;
    }
}
