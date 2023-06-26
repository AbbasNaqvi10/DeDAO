// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import "./GovernorSettings.sol";

contract Governance is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorTimelockControl
{
    IERC20 public token;

    struct ProposerStake {
        address creator;
        uint256 amountStaked;
        uint256 blockNumberDurationStart;
        uint256 blockNumberDurationEnd;
    }
    struct VoterStake {
        uint256 amountStaked;
        uint256 blockNumberDurationEnd;
    }

    mapping(uint256 => ProposerStake) private _proposalSnapshot;
    mapping(uint256 => mapping(address => VoterStake)) private _votingSnapshot;

    constructor(
        string memory _name,
        address _token,
        uint256 _votingDelay,
        uint256 _votingPeriod,
        uint256 _proposalThreshold,
        uint256 _minTokensForProposal,
        uint256 _minParticipation,
        TimelockController _timelock
    )
        Governor(_name)
        GovernorSettings(
            _votingDelay,
            _votingPeriod,
            _proposalThreshold,
            _minTokensForProposal,
            _minParticipation
        )
        GovernorTimelockControl(_timelock)
    {
        token = IERC20(_token);
    }

    // The following functions are overrides required by Solidity.

    function votingDelay()
        public
        view
        override(IGovernor, GovernorSettings)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public
        view
        override(IGovernor, GovernorSettings)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function _getVotes(
        address account,
        uint256 timepoint,
        bytes memory params
    ) internal view virtual override returns (uint256) {
        return token.balanceOf(account);
    }

    // function quorum(
    //     uint256 blockNumber
    // )
    //     public
    //     view
    //     override(IGovernor, GovernorVotesQuorumFraction)
    //     returns (uint256)
    // {
    //     return super.quorum(blockNumber);
    // }

    function state(
        uint256 proposalId
    )
        public
        view
        override(Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) public override(Governor, IGovernor) returns (uint256) {
        require(
            token.balanceOf(_msgSender()) >= minTokensForProposal(),
            "Not have enough tokens to create proposal"
        );
        token.transfer(address(this), minTokensForProposal());
        uint256 proposalId = super.propose(
            targets,
            values,
            calldatas,
            description
        );
        _proposalSnapshot[proposalId] = ProposerStake({
        creator: _msgSender(),
        amountStaked: minTokensForProposal(),
        blockNumberDurationStart: proposalSnapshot(proposalId),
        blockNumberDurationEnd: proposalSnapshot(proposalId) + votingPeriod()
        });

        return proposalId;
    }

    function proposalThreshold()
        public
        view
        override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    function _execute(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._execute(proposalId, targets, values, calldatas, descriptionHash);
        if(state(proposalId) == ProposalState.Executed){
            token.transferFrom(address(this), _proposalSnapshot[proposalId].creator, _proposalSnapshot[proposalId].amountStaked);
        }
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal
        view
        override(Governor, GovernorTimelockControl)
        returns (address)
    {
        return super._executor();
    }

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(Governor, GovernorTimelockControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function clock() public view override returns (uint48) {
        return SafeCast.toUint48(block.number);
    }

    function CLOCK_MODE() public view override returns (string memory) {}

    function quorum(
        uint256 timepoint
    ) public view virtual override returns (uint256) {}

}
