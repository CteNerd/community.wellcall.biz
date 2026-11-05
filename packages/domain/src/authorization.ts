export type MentorMembership = {
  userId: string;
  active: boolean;
  approved: boolean;
};

export type MentorshipAssignment = {
  mentorId: string;
  participantId: string;
  programId: string;
  active: boolean;
};

export function canAccessRelationship(
  membership: MentorMembership | null,
  assignment: MentorshipAssignment | null,
  resource: { participantId: string; programId: string },
): boolean {
  return membership?.active === true && membership.approved
    && assignment?.active === true && assignment.mentorId === membership.userId
    && assignment.participantId === resource.participantId
    && assignment.programId === resource.programId;
}
