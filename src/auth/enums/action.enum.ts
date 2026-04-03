/**
 * CASL action vocabulary.
 *
 * `Manage` is the CASL wildcard that implies every other action.
 * Use it only for super-admin blanket grants, never for regular users.
 *
 * Keep this enum in sync with every ability rule defined in
 * CaslAbilityFactory — adding a new action here without a corresponding
 * rule means no one can ever perform it.
 */
export enum Action {
  Manage = 'manage', // wildcard — implies Create | Read | Update | Delete
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
}
