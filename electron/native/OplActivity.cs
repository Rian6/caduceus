using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.NetworkInformation;
using System.Runtime.InteropServices;
using System.Text;

// Read-only inspection of OPLServer's connections and open disk file handles.
public static class OplActivity
{
    [DllImport("iphlpapi.dll")]
    static extern uint GetExtendedTcpTable(IntPtr table, ref int size, bool order, int family, int tableClass, uint reserved);
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern IntPtr OpenProcess(uint access, bool inherit, int pid);
    [DllImport("kernel32.dll")]
    static extern bool CloseHandle(IntPtr handle);
    [DllImport("kernel32.dll")]
    static extern IntPtr GetCurrentProcess();
    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool DuplicateHandle(IntPtr source, IntPtr handle, IntPtr target, out IntPtr duplicate, uint access, bool inherit, uint options);
    [DllImport("kernel32.dll")]
    static extern uint GetFileType(IntPtr handle);
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern uint GetFinalPathNameByHandle(IntPtr handle, StringBuilder path, uint size, uint flags);
    [DllImport("ntdll.dll")]
    static extern int NtQueryInformationProcess(IntPtr process, int infoClass, IntPtr info, int size, out int returned);

    [StructLayout(LayoutKind.Sequential)]
    struct HandleEntry
    {
        public IntPtr Handle;
        public UIntPtr HandleCount, PointerCount;
        public uint Access, TypeIndex, Attributes, Reserved;
    }

    static HashSet<int> ConnectedServers(int port)
    {
        var ownAddresses = new HashSet<string>();
        foreach (var nic in NetworkInterface.GetAllNetworkInterfaces())
            foreach (var address in nic.GetIPProperties().UnicastAddresses)
                ownAddresses.Add(address.Address.ToString());
        int size = 0;
        GetExtendedTcpTable(IntPtr.Zero, ref size, false, 2, 5, 0); // IPv4, OWNER_PID_ALL
        for (int attempt = 0; attempt < 3; attempt++)
        {
            IntPtr buffer = Marshal.AllocHGlobal(size);
            try
            {
                uint result = GetExtendedTcpTable(buffer, ref size, false, 2, 5, 0);
                if (result == 122) continue;
                if (result != 0) throw new Win32Exception((int)result);
                var pids = new HashSet<int>();
                int count = Marshal.ReadInt32(buffer);
                for (int i = 0; i < count; i++)
                {
                    IntPtr row = IntPtr.Add(buffer, 4 + i * 24);
                    int localPort = Marshal.ReadByte(row, 8) * 256 + Marshal.ReadByte(row, 9);
                    var remote = new IPAddress(BitConverter.GetBytes(Marshal.ReadInt32(row, 12)));
                    if (Marshal.ReadInt32(row) == 5 && localPort == port &&
                        !IPAddress.IsLoopback(remote) && !ownAddresses.Contains(remote.ToString()))
                        pids.Add(Marshal.ReadInt32(row, 20));
                }
                return pids;
            }
            finally { Marshal.FreeHGlobal(buffer); }
        }
        throw new IOException("TCP connection table kept changing.");
    }

    // Exposed separately so handle open/close can be tested without a physical PS2.
    public static string[] GetOpenImages(int pid)
    {
        IntPtr process = OpenProcess(0x440, false, pid); // QUERY_INFORMATION | DUP_HANDLE
        if (process == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
        try
        {
            for (int size = 65536; size <= 16 * 1024 * 1024; size *= 2)
            {
                IntPtr buffer = Marshal.AllocHGlobal(size);
                try
                {
                    int returned;
                    int status = NtQueryInformationProcess(process, 51, buffer, size, out returned);
                    if (status == unchecked((int)0xC0000004) || status == unchecked((int)0xC0000023)) continue;
                    if (status < 0) throw new IOException("Cannot inspect OPL handles: 0x" + status.ToString("X8"));
                    long count = Marshal.ReadIntPtr(buffer).ToInt64();
                    int stride = Marshal.SizeOf(typeof(HandleEntry));
                    if (count < 0 || count > (size - 2 * IntPtr.Size) / stride) throw new IOException("Invalid handle snapshot.");
                    var paths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
                    for (int i = 0; i < count; i++)
                    {
                        var entry = (HandleEntry)Marshal.PtrToStructure(IntPtr.Add(buffer, 2 * IntPtr.Size + i * stride), typeof(HandleEntry));
                        IntPtr handle;
                        if (!DuplicateHandle(process, entry.Handle, GetCurrentProcess(), out handle, 0, false, 2)) continue;
                        try
                        {
                            if (GetFileType(handle) != 1) continue; // Disk handles only; never query pipes.
                            var path = new StringBuilder(32768);
                            uint length = GetFinalPathNameByHandle(handle, path, (uint)path.Capacity, 0);
                            if (length == 0 || length >= path.Capacity) continue;
                            string full = path.ToString();
                            if (full.StartsWith(@"\\?\UNC\", StringComparison.OrdinalIgnoreCase)) full = @"\\" + full.Substring(8);
                            else if (full.StartsWith(@"\\?\")) full = full.Substring(4);
                            string ext = Path.GetExtension(full).ToLowerInvariant();
                            if (ext == ".iso" || ext == ".zso" || ext == ".bin") paths.Add(full);
                        }
                        finally { CloseHandle(handle); }
                    }
                    return new List<string>(paths).ToArray();
                }
                finally { Marshal.FreeHGlobal(buffer); }
            }
            throw new IOException("OPL handle snapshot is too large.");
        }
        finally { CloseHandle(process); }
    }

    public static string[] GetActiveImages(int port)
    {
        var paths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (int pid in ConnectedServers(port))
        {
            using (var process = Process.GetProcessById(pid))
            {
                if (!String.Equals(process.ProcessName, "OPLServer", StringComparison.OrdinalIgnoreCase)) continue;
                foreach (string path in GetOpenImages(pid)) paths.Add(path);
            }
        }
        return new List<string>(paths).ToArray();
    }
}
