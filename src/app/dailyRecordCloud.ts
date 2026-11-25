import { createEmptyDailyRecordAggregate } from "../domain/factories/createEmptyDailyRecordAggregate";
import { normalizeDailyRecordAggregate } from "../domain/normalizers/normalizeDailyRecordAggregate";
import type {
  DailyRecordAggregate,
  ISODate,
  ISODateTime,
} from "../domain/type";

type CloudRecordIdentity = {
  userId: string;
  date: ISODate;
};

type PrepareCloudSaveParams = CloudRecordIdentity & {
  record: DailyRecordAggregate;
  savedAt?: ISODateTime;
};

type NormalizeCloudRecordParams = CloudRecordIdentity & {
  record: DailyRecordAggregate;
};

const applyCloudIdentity = (
  record: DailyRecordAggregate,
  { userId, date }: CloudRecordIdentity,
): DailyRecordAggregate => ({
  ...record,
  daily_record: {
    ...record.daily_record,
    user_id: userId,
    record_date: date,
  },
});

export const createEmptyCloudDailyRecord = ({
  userId,
  date,
}: CloudRecordIdentity): DailyRecordAggregate =>
  applyCloudIdentity(createEmptyDailyRecordAggregate(date), { userId, date });

export const normalizeCloudDailyRecord = ({
  record,
  userId,
  date,
}: NormalizeCloudRecordParams): DailyRecordAggregate =>
  applyCloudIdentity(normalizeDailyRecordAggregate(record), { userId, date });

export const prepareDailyRecordForCloudSave = ({
  record,
  userId,
  date,
  savedAt = new Date().toISOString(),
}: PrepareCloudSaveParams): DailyRecordAggregate => {
  const identified = normalizeCloudDailyRecord({ record, userId, date });

  return {
    ...identified,
    daily_record: {
      ...identified.daily_record,
      updated_at: savedAt,
    },
  };
};
