import { memo } from "react";
import WarRoomLayout, { WarRoomLayoutProps } from "./WarRoomLayout";

export type { WarRoomLayoutProps as BoardroomTableProps };

export default memo(function BoardroomTable(props: WarRoomLayoutProps) {
  return <WarRoomLayout {...props} />;
});
