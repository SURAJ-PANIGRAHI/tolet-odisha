export const ID_TYPES = {
 passport:'Passport',voter_id:'Voter ID',masked_aadhaar:'Aadhaar (masked)',driving_licence:'Driving Licence',
} as const;
export type IdType=keyof typeof ID_TYPES;
export const ID_REJECTION_REASONS=['Blurry image','Name mismatch','Incomplete ID','Unsupported document'] as const;
export type IdRecord={id:string|null;user_id?:string;account_name:string|null;document_type:IdType;status:string;rejection_reason:string|null;submitted_at:string|null;reviewed_at:string|null;delete_after:string|null;has_file:boolean;is_admin?:boolean};
