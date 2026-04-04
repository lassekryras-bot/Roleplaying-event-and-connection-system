@full
Feature: Invite flow

  @smoke @full
  Scenario: should allow gm to create an invite
    Given a project exists with active gm helper and player memberships
    And I am authenticated as a GM for that project
    When I submit a valid invite payload
    Then the invite request should be created

  @full
  Scenario: should deny player invite creation
    Given a project exists with active gm helper and player memberships
    And I am authenticated as a Player for that project
    When I submit a valid invite payload
    Then the invite request should be forbidden
