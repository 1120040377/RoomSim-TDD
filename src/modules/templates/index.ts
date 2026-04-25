export type { TemplateMeta } from './_utils';

import { blankTemplate } from './blank';
import { masterBedroomTemplate } from './rooms/master-bedroom';
import { secondaryBedroomTemplate } from './rooms/secondary-bedroom';
import { livingRoomTemplate } from './rooms/living-room';
import { studyTemplate } from './rooms/study';
import { bathroomTemplate } from './rooms/bathroom';
import { openKitchenTemplate } from './rooms/kitchen-open';
import { studioTemplate } from './apartments/studio';
import { oneBedOneLivingTemplate } from './apartments/one-bed-one-living';
import { twoBedOneLivingTemplate } from './apartments/two-bed-one-living';
import { twoBedTwoLivingTemplate } from './apartments/two-bed-two-living';
import { threeBedTwoLivingTemplate } from './apartments/three-bed-two-living';

export const BUILT_IN_TEMPLATES = [
  blankTemplate,
  // 单间练习
  masterBedroomTemplate,
  secondaryBedroomTemplate,
  livingRoomTemplate,
  studyTemplate,
  bathroomTemplate,
  openKitchenTemplate,
  // 完整户型
  studioTemplate,
  oneBedOneLivingTemplate,
  twoBedOneLivingTemplate,
  twoBedTwoLivingTemplate,
  threeBedTwoLivingTemplate,
];

export function getTemplate(id: string) {
  return BUILT_IN_TEMPLATES.find((t) => t.id === id);
}
