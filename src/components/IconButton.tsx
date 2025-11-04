import { PencilSquareIcon, TrashIcon } from "@heroicons/react/24/solid";

interface IconButtonProps {
  type: "edit" | "delete";
  onClick: () => void;
}

export default function IconButton({ type, onClick }: IconButtonProps) {
  const config = {
    edit: {
      bg: "bg-green-500 hover:bg-green-600",
      icon: <PencilSquareIcon className="w-5 h-5 text-white fill-current" />,
    },
    delete: {
      bg: "bg-red-500 hover:bg-red-600",
      icon: <TrashIcon className="w-5 h-5 text-white fill-current" />,
    },
  };

  return (
    <button
      onClick={onClick}
      className={`p-2 rounded inline-flex items-center justify-center appearance-none ${config[type].bg}`}
    >
      {config[type].icon}
    </button>
  );
}