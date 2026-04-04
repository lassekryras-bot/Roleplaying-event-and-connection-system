@integration
Feature: Timeline endpoint integration

  Scenario: should return deterministically ordered timeline events
    When I request the timeline events endpoint as a player
    Then I should receive deterministically ordered timeline events

  Scenario: should return role-safe timeline payload for player role
    When I request the timeline events endpoint as a player
    Then each timeline event should be player safe
