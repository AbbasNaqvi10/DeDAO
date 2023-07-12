// SPDX-License-Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (governance/extensions/GovernorSettings.sol)

pragma solidity ^0.8.17;

import "./Governance.sol";

/**
 * @dev Extension of {Governor} for settings updatable through governance.
 *
 * _Available since v4.4._
 */
abstract contract GovernanceSettings is Governance {
    uint256 private _votingPeriod;
    uint256 private _proposalThreshold;
    uint256 private _minTokensForProposal;
    uint256 private _minParticipation;

    event VotingPeriodSet(uint256 oldVotingPeriod, uint256 newVotingPeriod);
    event ProposalThresholdSet(uint256 oldProposalThreshold, uint256 newProposalThreshold);
    event MinTokensForProposalSet(uint256 oldMinTokensForProposal, uint256 newMinTokensForProposal);
    event MinParticipationSet(uint256 oldMinParticipation, uint256 newMinParticipation);

    /**
     * @dev Initialize the governance parameters.
     */
    constructor(uint256 initialVotingPeriod, uint256 initialProposalThreshold, uint256 initialMinTokensForProposal, uint256 initialMinParticipation) {
        _setVotingPeriod(initialVotingPeriod);
        _setProposalThreshold(initialProposalThreshold);
        _setMinTokensForProposal(initialMinTokensForProposal);
        _setMinParticipation(initialMinParticipation);
    }

    /**
     * @dev See {IGovernor-votingPeriod}.
     */
    function votingPeriod() public view virtual override returns (uint256) {
        return _votingPeriod;
    }

    /**
     * @dev See {Governor-proposalThreshold}.
     */
    function proposalThreshold() public view virtual override returns (uint256) {
        return _proposalThreshold;
    }

    /**
     * @dev See {Governor-numberOfTokensForProposal}.
     */
    function minTokensForProposal() public view virtual returns (uint256) {
        return _minTokensForProposal;
    }

    /**
     * @dev See {Governor-minParticipation}.
     */
    function minParticipation() public view virtual returns (uint256) {
        return _minParticipation;
    }

    /**
     * @dev Update the voting period. This operation can only be performed through a governance proposal.
     *
     * Emits a {VotingPeriodSet} event.
     */
    function setVotingPeriod(uint256 newVotingPeriod) public virtual onlyGovernance {
        _setVotingPeriod(newVotingPeriod);
    }

    /**
     * @dev Update the proposal threshold. This operation can only be performed through a governance proposal.
     *
     * Emits a {ProposalThresholdSet} event.
     */
    function setProposalThreshold(uint256 newProposalThreshold) public virtual onlyGovernance {
        _setProposalThreshold(newProposalThreshold);
    }

    /**
     * @dev Update the proposal threshold. This operation can only be performed through a governance proposal.
     *
     * Emits a {MinTokensForProposalSet} event.
     */
    function setMinTokensForPropopsal(uint256 newMinTokensForProposal) public virtual onlyGovernance {
        _setMinTokensForProposal(newMinTokensForProposal);
    }

    /**
     * @dev Update the proposal min participation. This operation can only be performed through a governance proposal.
     *
     * Emits a {MinParticipationSet} event.
     */
    function setMinParticipation(uint256 newMinParticipation) public virtual onlyGovernance {
        _setMinParticipation(newMinParticipation);
    }

    /**
     * @dev Internal setter for the voting period.
     *
     * Emits a {VotingPeriodSet} event.
     */
    function _setVotingPeriod(uint256 newVotingPeriod) internal virtual {
        // voting period must be at least one block long
        require(newVotingPeriod > 0, "GovernorSettings: voting period too low");
        emit VotingPeriodSet(_votingPeriod, newVotingPeriod);
        _votingPeriod = newVotingPeriod;
    }

    /**
     * @dev Internal setter for the proposal threshold.
     *
     * Emits a {ProposalThresholdSet} event.
     */
    function _setProposalThreshold(uint256 newProposalThreshold) internal virtual {
        emit ProposalThresholdSet(_proposalThreshold, newProposalThreshold);
        _proposalThreshold = newProposalThreshold;
    }

    /**
     * @dev Internal setter for the proposal threshold.
     *
     * Emits a {MinTokensForProposalSet} event.
     */
    function _setMinTokensForProposal(uint256 newMinTokensForProposal) internal virtual {
        emit MinTokensForProposalSet(_minTokensForProposal, newMinTokensForProposal);
        _minTokensForProposal = newMinTokensForProposal;
    }

    /**
     * @dev Internal setter for the proposal threshold.
     *
     * Emits a {MinParticipationSet} event.
     */
    function _setMinParticipation(uint256 newMinParticipation) internal virtual {
        emit MinParticipationSet(_minParticipation, newMinParticipation);
        _minParticipation = newMinParticipation;
    }
}
