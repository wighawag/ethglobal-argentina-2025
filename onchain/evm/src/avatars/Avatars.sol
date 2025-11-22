// SPDX-License-Identifier: AGPL-3.0-or-later
pragma solidity ^0.8.0;

import "solidity-kit/solc_0_8/ERC721/implementations/EnumerableERC721.sol";
import "solidity-kit/solc_0_8/ERC721/interfaces/IERC721Metadata.sol";

contract Avatars is EnumerableERC721, IERC721Metadata {
    constructor() {}

    // ------------------------------------------------------------------------
    // ERC-721
    // ------------------------------------------------------------------------

    /// @inheritdoc IERC721Metadata
    function name() public view returns (string memory) {
        return "Conquest.eth Avatars";
    }

    /// @inheritdoc IERC721Metadata
    function symbol() public view returns (string memory) {
        return "AVATAR";
    }

    /// @inheritdoc IERC721Metadata
    function tokenURI(uint256) external view returns (string memory) {
        return
            'data:application/json,{"name":"Conquest.eth%20Avatars","description":"Unique%20Emperors.","image":""}';
    }

    function mint(
        address to,
        uint256 tokenID,
        bytes calldata data
    ) external payable {
        _safeMint(to, tokenID, false, data);
    }
}
