---
name: convert-lead
description: Use when a qualified lead should become a contact, optionally with a deal (for example "convert this lead" or "Pia is qualified, make her a contact and open a deal"). Creates the contact, links the company, and marks the lead converted, safely repeatable.
---

# Convert a lead to a contact

A lead is a person who has shown interest. A contact is a person you work with. Converting keeps the lead (marked `converted`) and creates a contact beside it. There is no convert tool: use the CRM tools in this order. The order makes it safe to run again after a failure, so do not reorder it.

## Steps

1. **Read both shapes.** `describe_object_type` for `lead` and `contact`. Copy only fields that exist on both with the same name and type. If the contact has a required field the lead lacks, ask the person once for it.
2. **Get the lead** with `get_record`. Leads are normally `qualified` first. If it is not, or it is `disqualified`, confirm with the person before going on.
3. **Resume check.** `list_linked_records` on the lead, link `lead_contact`. If a contact is already there, a previous run got this far: reuse it and skip to step 6.
4. **Look for an existing contact** with `filter_records` on `contact` by the lead's email. If one exists, use it and tell the person you reused it. Do not create a second.
5. **Create the contact** with `create_record`: first_name, last_name, email, phone and job_title from the lead, and `lifecycle_stage: "qualified"`. Never put links in `properties`. If this fails with `DUPLICATE_VALUE` and an `existing_id`, use that contact. If there is no `existing_id`, a contact with that email exists that the person cannot see: stop and say so. Do not try to find it.
6. **Link the company.** `list_linked_records` on the lead, link `lead_company`, then `link_record` each company to the contact through `contact_company`.
7. **Deal, only if the person asked for one.** `create_record` a `deal` named for the company or person, `stage: "new"`, then `link_record` the contact to it through `contact_deal` and the deal to the company through `deal_company`. Check `list_linked_records` first so a repeat does not open a second deal.
8. **Link the contact back:** `link_record` on the lead, link `lead_contact`, `record_id` the contact. A lead holds one contact, so this replaces any other.
9. **Mark converted, last:** `update_record` the lead, `status: "converted"`.

## Rules

- If any step fails, stop, say which step and why, and leave the lead unmarked. Running the skill again resumes from step 3.
- Never delete the lead. Do not create a deal unless the person asked.
- Finish with one short summary: the contact (name and id), the companies linked, the deal if any, and anything reused rather than created.
