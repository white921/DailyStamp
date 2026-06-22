import mysql from "mysql2/promise";
import { DEFAULT_HABITS } from "../../constants/habits.js";
import { getCurrentMonthKey, getMonthBounds } from "../../lib/time.js";

export async function createStampStore(mysqlConfig) {
  const pool = mysql.createPool({
    ...mysqlConfig,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS master_habits (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL,
      sort_order INT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_master_habit_name (name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stamps (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(32) NOT NULL,
      habit_id BIGINT UNSIGNED NOT NULL,
      stamp_date DATE NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_habit_stamp_date (user_id, habit_id, stamp_date),
      CONSTRAINT fk_stamps_master_habit
        FOREIGN KEY (habit_id) REFERENCES master_habits(id)
        ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  for (const [index, name] of DEFAULT_HABITS.entries()) {
    await pool.execute(
      `
        INSERT INTO master_habits (name, sort_order)
        VALUES (:name, :sortOrder)
        ON DUPLICATE KEY UPDATE sort_order = VALUES(sort_order)
      `,
      {
        name,
        sortOrder: index + 1,
      },
    );
  }

  async function listMasterHabits() {
    const [rows] = await pool.execute(
      `
        SELECT id, name, sort_order AS sortOrder
        FROM master_habits
        ORDER BY sort_order ASC, id ASC
      `,
    );

    return rows;
  }

  async function getHabitById(habitId) {
    const [rows] = await pool.execute(
      `
        SELECT id, name
        FROM master_habits
        WHERE id = ?
        LIMIT 1
      `,
      [habitId],
    );

    return rows[0] ?? null;
  }

  async function hasStamp({ userId, habitId, stampDate }) {
    const [rows] = await pool.execute(
      `
        SELECT 1
        FROM stamps
        WHERE user_id = :userId
          AND habit_id = :habitId
          AND stamp_date = :stampDate
        LIMIT 1
      `,
      { userId, habitId, stampDate },
    );

    return Boolean(rows[0]);
  }

  async function getMonthData(userId, monthKey = getCurrentMonthKey()) {
    const { start, end, daysInMonth, startsOn } = getMonthBounds(monthKey);
    const habits = await listMasterHabits();
    const [stampRows] = await pool.execute(
      `
        SELECT
          habit_id AS habitId,
          DATE_FORMAT(stamp_date, '%Y-%m-%d') AS stampDate
        FROM stamps
        WHERE user_id = :userId
          AND stamp_date BETWEEN :startDate AND :endDate
        ORDER BY habit_id ASC, stamp_date ASC
      `,
      {
        userId,
        startDate: start,
        endDate: end,
      },
    );

    const stampsByHabit = new Map(habits.map((habit) => [habit.id, []]));

    for (const row of stampRows) {
      stampsByHabit.get(row.habitId)?.push(row.stampDate);
    }

    return {
      monthKey,
      daysInMonth,
      startsOn,
      habits: habits.map((habit) => ({
        ...habit,
        stamps: stampsByHabit.get(habit.id) ?? [],
      })),
    };
  }

  async function toggleStamp({ userId, habitId, stampDate }) {
    const habit = await getHabitById(habitId);

    if (!habit) {
      throw new Error("Habit not found");
    }

    const existing = await hasStamp({ userId, habitId, stampDate });

    if (existing) {
      await pool.execute(
        `
          DELETE FROM stamps
          WHERE user_id = :userId
            AND habit_id = :habitId
            AND stamp_date = :stampDate
        `,
        { userId, habitId, stampDate },
      );

      return { stamped: false, habitName: habit.name };
    }

    await pool.execute(
      `
        INSERT INTO stamps (user_id, habit_id, stamp_date)
        VALUES (:userId, :habitId, :stampDate)
      `,
      { userId, habitId, stampDate },
    );

    return { stamped: true, habitName: habit.name };
  }

  return {
    getMonthData,
    listMasterHabits,
    toggleStamp,
    pool,
  };
}
