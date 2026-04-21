export const ADMIN_REG_NOS = [
  '927625BSC059',
  '927624BCS011',
  '927625BEC047',
  '927625BIT090',
  '927625BCS127',
  '927625BSC024',
  '927625BSC005'
];

export type CourseType = 'THEORY' | 'TCPL' | 'TCPR';

export interface AssessmentItem {
  id: string;
  max: number;
  weight: number;
}

export interface CourseConfig {
  title: string;
  ratio: string;
  internalMax: number;
  eseWeight: number;
  items: AssessmentItem[];
  ese: AssessmentItem;
}

export const COURSE_DATA: Record<CourseType, CourseConfig> = {
  THEORY: {
    title: "Theory Course",
    ratio: "40%: 60%",
    internalMax: 40,
    eseWeight: 60,
    items: [
      { id: "CIA 1", max: 60, weight: 6 },
      { id: "CIA 2", max: 60, weight: 6 },
      { id: "Model Exam", max: 100, weight: 12 },
      { id: "SSA 1", max: 20, weight: 3 },
      { id: "SSA 2", max: 20, weight: 3 },
      { id: "AL 1", max: 20, weight: 5 },
      { id: "AL 2", max: 20, weight: 5 },
    ],
    ese: { id: "ESE", max: 100, weight: 60 }
  },
  TCPL: {
    title: "TCPL Course (Theory + Lab)",
    ratio: "50%: 50%",
    internalMax: 50,
    eseWeight: 50,
    items: [
      { id: "CIA 1", max: 60, weight: 6.5 },
      { id: "CIA 2", max: 60, weight: 6.5 },
      { id: "Model Exam", max: 100, weight: 12 },
      { id: "SSA 1", max: 20, weight: 2 },
      { id: "SSA 2", max: 20, weight: 2 },
      { id: "LAB 1", max: 30, weight: 7 },
      { id: "LAB 2", max: 30, weight: 7 },
      { id: "LAB 3", max: 30, weight: 7 },
    ],
    ese: { id: "ESE (T & L)", max: 100, weight: 50 }
  },
  TCPR: {
    title: "TCPR Course (Theory + Project)",
    ratio: "50%: 50%",
    internalMax: 50,
    eseWeight: 50,
    items: [
      { id: "CIA 1", max: 60, weight: 6.5 },
      { id: "CIA 2", max: 60, weight: 6.5 },
      { id: "Model Exam", max: 80, weight: 12 },
      { id: "SSA 1", max: 20, weight: 2 },
      { id: "SSA 2", max: 20, weight: 2 },
      { id: "REVIEW 1", max: 30, weight: 3 },
      { id: "REVIEW 2", max: 30, weight: 8 },
      { id: "REVIEW 3", max: 30, weight: 10 },
    ],
    ese: { id: "ESE (T & R)", max: 100, weight: 50 }
  }
};
