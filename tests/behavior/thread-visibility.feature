Feature: Thread visibility

  Scenario: should hide gm truth from player thread detail
    Given a thread exists with gm_truth and player_summary
    And I am authenticated as a Player in the same project
    When I request the thread detail endpoint
    Then I should receive player_summary
    And I should not receive gm_truth

  Scenario: should allow gm to view gm truth in thread detail
    Given a thread exists with gm_truth and player_summary
    And I am authenticated as a GM in the same project
    When I request the thread detail endpoint
    Then I should receive gm_truth
    And I should receive player_summary
