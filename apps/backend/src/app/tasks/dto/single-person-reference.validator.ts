import {
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';

/** A task references at most one person: a contact or a prospect. */
@ValidatorConstraint({ name: 'singlePersonReference' })
export class SinglePersonReference implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments) {
    const { prospectId } = args.object as { prospectId?: unknown };
    return prospectId === undefined || prospectId === null;
  }

  defaultMessage() {
    return 'contactId and prospectId cannot both be set';
  }
}
