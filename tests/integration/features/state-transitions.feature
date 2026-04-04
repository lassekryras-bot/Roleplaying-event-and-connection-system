@integration
Feature: Thread state transitions integration

  Scenario: should allow valid escalation transitions
    When I request to escalate and resolve the active thread as GM
    Then the transition sequence should succeed

  Scenario: should reject non-canonical thread states with deterministic validation error
    When I request a non-canonical state transition
    Then I should receive deterministic invalid state error

  Scenario: should reject invalid escalation transitions
    When I request an invalid dormant to escalated transition
    Then I should receive invalid transition details

  Scenario: should forbid removed member thread updates with consistent forbidden shape
    When I request a thread update as a removed member
    Then I should receive forbidden response shape
