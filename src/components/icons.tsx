export function BasketballIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M4.2 14.2c3.1-3.1 8.9-3.1 12 0" />
      <path d="M14.2 4.2c-3.1 3.1-3.1 8.9 0 12" />
      <path d="M12 22V2" />
      <path d="M22 12H2" />
    </svg>
  );
}
