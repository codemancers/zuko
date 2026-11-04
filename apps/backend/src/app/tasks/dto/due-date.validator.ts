import {
  ValidatorConstraint,
  type ValidatorConstraintInterface,
} from 'class-validator';
import { isDueDateString } from '@zuko/sales';

/** A real calendar day as YYYY-MM-DD; timestamps and offsets are rejected. */
@ValidatorConstraint({ name: 'dueDate' })
export class DueDateString implements ValidatorConstraintInterface {
  validate(value: unknown) {
    return isDueDateString(value);
  }

  defaultMessage() {
    return 'dueDate must be a calendar date in YYYY-MM-DD format or null';
  }
}
