import { eveChannel } from 'eve/channels/eve';
import { withAuthChallenges } from 'eve/channels/auth';
import { zukoAuth } from '../lib/auth';

export default eveChannel({ auth: withAuthChallenges(zukoAuth(true), [{ scheme: 'Bearer' }]) });
