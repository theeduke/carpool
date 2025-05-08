import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
// import axios from "../utils/axiosInstance";
import axiosInstance from "../../utils/axiosInstance";

// Refresh Token Action
export const refreshToken = createAsyncThunk("auth/refreshToken", async (_, { rejectWithValue }) => {
  try {
    const response = await axios.post("/auth/token/refresh/", {
      refresh: localStorage.getItem("refreshToken"), // Use stored refresh token
    });

    localStorage.setItem("accessToken", response.data.access); // Store new token
    return response.data;
  } catch (error) {
    return rejectWithValue(error.response.data);
  }
});

// Logout Action
export const logoutUser = createAsyncThunk("auth/logout", async () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
});

const authSlice = createSlice({
  name: "auth",
  initialState: {
    user: null,
    accessToken: localStorage.getItem("accessToken") || null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(refreshToken.fulfilled, (state, action) => {
        state.accessToken = action.payload.access;
      })
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
      });
  },
});

export default authSlice.reducer;



// import { createSlice } from "@reduxjs/toolkit";

// const initialState = {
//     user: null,
//     token: null,
//     isAuthenticated: false,
// };

// const authSlice = createSlice({
//     name: "auth",
//     initialState,
//     reducers: {
//         login: (state, action) => {
//             state.user = action.payload.user;
//             state.token = action.payload.token;
//             state.isAuthenticated = true;
//         },
//         logout: (state) => {
//             state.user = null;
//             state.token = null;
//             state.isAuthenticated = false;
//         },
//     },
// });

// export const { login, logout } = authSlice.actions;
// export default authSlice.reducer;
