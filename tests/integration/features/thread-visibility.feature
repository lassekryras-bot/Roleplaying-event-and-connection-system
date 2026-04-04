@integration
Feature: Thread visibility integration

  Scenario: should return player-safe payload for player thread detail
    Given I am authenticated as a Player in the same project
    When I request the thread detail endpoint
    Then I should receive player_summary without gm_truth
